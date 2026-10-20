# Core concepts

This page answers "why the code sits where it sits": which layer an artifact belongs to, what that layer is allowed to import, what you have to do after editing it, and which naming and path conventions are enforced. The rules themselves live in `CODE_STANDARD.md` and in the "key constraints" note of `README.md`; here they are matched against the actual code.

## Four layers

```
apps/web/          @antdv/web — the admin app, the only entry the browser executes
apps/backend-mock/ Nitro mock, started in-process during dev; API handlers and menu seed data
docs/              the VitePress site (@antdv/docs), a sibling of apps/, not part of the app build
packages/          21 runtime packages: they end up inside the browser bundle
internal/          build-time tooling: runs only in Node, never shipped (vite-config / lint-configs / tsconfig / node-utils)
scripts/           repository tasks (vsh, turbo-run, clean, deploy)
```

The split is not "does this look like a library", it is **who consumes the artifact**. `internal/vite-config` produces `defineApplicationConfig()`, called exactly once from `apps/web/vite.config.ts`; `packages/core/base/shared` produces ESM that Vite consumes directly. That is why `turbo.json` puts `dependsOn: ["^build"]` on both `dev` and `build` — upstream packages emit `dist` before a downstream task runs.

## Two publish shapes, two ways to make an edit take effect

| Shape | Packages | `main` points at | After editing `src` |
| --- | --- | --- | --- |
| dist-published | `@antdv/shared`, `@antdv/hooks`, `@antdv/directives`, `@antdv/preferences`, `@antdv/router`, `@antdv/types` | `./dist/index.js` (`@antdv/types`: `./dist/index.mjs`) | run `pnpm --filter @antdv/shared build`, then restart dev |
| source-published | `@antdv/icons`, `@antdv/design`, the eight packages under `packages/core/ui-kit/` (`@antdv/common-ui` / `@antdv/shadcn-ui` / `@antdv/form-ui` / `@antdv/table-ui` / `@antdv/popup-ui` / `@antdv/layout-ui` / `@antdv/menu-ui` / `@antdv/tabs-ui` — there is no `@antdv/ui-kit` package, `ui-kit` is only a directory name), plus `@antdv/layouts` / `@antdv/stores` / `@antdv/enums` / `@antdv/utils` / `@antdv/request` | `./src/index.ts` (`design`: `./src/index.css`) | hot-reloads, there is no build step |

Evidence: the `main` field of each `packages/**/package.json` (base layer under `packages/core/base/`, UI layer under `packages/core/ui-kit/`), plus the `entry` of `packages/core/base/shared/tsdown.config.ts` (`:16-22`, **five** patterns: `'src/index.ts'`, `'src/*.ts'`, `'src/*/*.ts'`, `'src/*/index.ts'`, `'src/*/*/index.ts'`). All six dist-published packages have a `build` script running `tsdown` — skip it and no new output is ever emitted; their `dev` script is `tsdown --watch`.

::: warning

You edited a dist-published package and nothing changed This is the most common "I clearly changed it" in this repository. Vite's dependency cache and `optimizeDeps` both point at `dist`, so `src` is simply not in the build graph. You edit, save, and see nothing — and get no error either.
:::

Being source-published has a cost: those packages have no `build` script at all (`packages/core/base/icons/package.json` only defines `clean` / `test:unit` / `type-check`), and their `<script setup>` blocks are compiled by the app's `@vitejs/plugin-vue`. So they cannot be consumed outside a Vite build.

## Package boundaries: no stores, no env

Nothing under `packages/*` may import `pinia`, an app store, or read `import.meta.env`. Two concrete reasons, not aesthetic preference:

1. **Package output lives in `dist`, out of reach of Vite's env static replacement.** Reading `import.meta.env` inside a package yields `undefined` and the behavior degrades silently. The app injects its environment instead: `apps/web/src/bootstrap/env.ts` calls `configureSharedEnv({ cachePrefix, cacheEncryptKey, ... })`, and `packages/core/base/shared/src/utils/env.ts` holds that explicit config. Preferences work the same way — the project-specific defaults are passed into `initPreferences({ defaults })` by `apps/web/src/settings/index.ts:92-97` (which forwards to `createPreferences()` inside the package, `packages/core/preferences/src/preferences.ts:160-165`).
2. **Unit tests need to flip branches.** A check like `shouldEncrypt()` ("encrypt only in production") is untestable when it reads env, and testable when it reads injected config — which is exactly what `packages/core/base/shared/__tests__/cache.test.ts` does.

"No stores" is enforced with dependency injection:

| Capability needed | What the package exposes | Where the app injects it |
| --- | --- | --- |
| Permission checks | `createPermissionDirective({ checkers, onCheck, subscribe })` (`packages/directives`) | `apps/web/src/directives/index.ts` |
| Route guards | guard factories in `@antdv/router` (auth state, menu loading, progress bar, title are all parameters) | `apps/web/src/router/guards/index.ts` |
| Layout shapes | `@antdv/layout-ui` ships the region render components plus the size contract; `@antdv/layouts` is the composition layer (`BasicLayout`, the header widgets, the layout hooks) | the app keeps only the thin shell `apps/web/src/layouts/index.vue` (the layouts plugin requires it) and the injection in `apps/web/src/plugins/layouts-host.ts` |

The one exception is `packages/utils/src/menu.ts:3`, which imports a **type** from `vue-router` (`import type { RouteRecordRaw }`). Types never reach the output, so the boundary holds.

::: tip

Where new code goes Relevant to one page only → inside that page's `views/<module>/<page>/` directory. App-wide but app-specific (stores, api, ws) → the matching folder under `apps/web/src/`. Pure functions that another project could reuse → `packages/core/base/shared` or `packages/core/hooks`. Requires pinia, the router, or backend data to work → keep a thin shell in the app and let the package receive the capability as an argument.
:::

## Aliases and auto-import

There are exactly two aliases, and both sides must agree:

| Alias | Resolves to | Declared in |
| --- | --- | --- |
| `~` | `apps/web/src` | `internal/vite-config/src/config/common.ts:16-25` and the `paths` block of `apps/web/tsconfig.app.json` |
| `#` | `apps/web/types` | same two places |

If the two drift apart, Vite runs but `vue-tsc` errors (or the reverse), so the aliases are defined once inside `createAliases()`. The same function sets `resolve.dedupe: ['pinia', 'vue', 'vue-router']` — pnpm's peer resolution once left both `vue` 3.5.42 and 3.5.43 types in the tree (the catalog now pins `vue` to `3.5.43`), and two Vue runtimes make `inject` and the reactivity system blind to each other.

Auto-import covers **framework APIs — not this repository's packages and not antdv-next** (`internal/vite-config/src/plugins/auto-import.ts:23-29`):

- `AutoImport` (`:23-26`): `vue`, `@vueuse/core`, `pinia`, `VueRouterAutoImports`. The four functional entry points of `antdv-next` (`message`, `notification`, `Modal`, `Drawer`) used to be listed here; they have been **removed** — import them yourself.
- `Components` (`:27-29`): **no resolvers at all**. It used to carry three — `AntdvNextResolver` (`a-*`), `AntdvUiResolver` (the sub-package components) and `IconifyResolver` (bare `<Icon>`) — and all three channels are now closed. The plugin keeps only its built-in behaviour: scan the app's `src/components` directory so local components need no import.
- The same factory also registers `iconifyOffline({ local: [...] })` (`:30-32`, the module being `@tomjs/vite-plugin-iconify`, imported at `:7`) plus `envParse` (`:33-37`); see [Icons](/en/guide/essentials/icons).
- The generated declarations `apps/web/types/auto-imports.d.ts` and `components.d.ts` are committed. Plugins rewrite them during the build, and on a Windows mapped drive that write occasionally fails with `UNKNOWN (errno -4094)` and takes the dev server down, hence the `VITE_WRITE_DTS=false` escape hatch — the switch itself is at `internal/vite-config/src/plugins/index.ts:65-67` and the comment explaining the trade-off at `:62-64` of that file (`auto-import.ts` carries no such comment).

Consequence: components and component-library APIs are **always imported explicitly**, in 100+ app files (106 of them import from `@antdv/*`) — for example `apps/web/src/components/business/ImportExport.vue:7-12`:

```ts
import { Scrollbar, Space } from '@antdv/common-ui';
import { alert, message } from '@antdv/popup-ui';

import { Button } from '@antdv/shadcn-ui';
import { generateTemplate } from '@antdv/shared/utils/template';
import { Icon } from '@iconify/vue';
```

`<script setup>` looks template bindings up by `capitalize(camelize(tag))`, so to keep writing `<AButton>` you alias the component to `AButton` (`apps/web/src/views/login/index.vue:25` writes `import { Button as AButton }`; a plain `import { Button }` only pairs with `<Button>`). The `vue/component-name-in-template-casing` rule rewrites kebab tags to PascalCase, which lines up with exactly that.

Bare `useRoute()` and `ref()` are what auto-import still handles; subpath imports such as `import { cn } from '@antdv/shared/utils/cn'` you also write by hand.

## Naming and the page skeleton

Section 1 of `CODE_STANDARD.md` fixes the granularity:

```
views/system/user/
├── index.vue      page entry
├── actions.ts     row actions, stateless, side effects injected via ctx
├── columns.ts     column definitions
├── schemas.ts     search / modal form schemas
├── constants.ts   constants and maps
├── types.ts       module types
├── utils.ts       module helpers
└── components/    page-private components
```

The `components/` and `widgets/` subfolders are what "private component" means operationally: file convention routing excludes them with `**/*/components/*`, the layout plugin skips `**/components/**` and `**/widgets/**` (`internal/vite-config/src/plugins/vue.ts:21-34,52-55`), and the end-to-end guard that forbids padding on a route page's root container uses the same criterion. Rename those folders and a page both becomes a route and gets double padding.

## Versions and releases

`version` in the root `package.json` (currently `0.4.0`) is the baseline for the whole repository, and every dependency version lives in the `catalog` block of `pnpm-workspace.yaml` — sub-packages only write `"xxx": "catalog:"`. To find a library's real version, read the catalog, not a sub-package manifest.

Releases go through changesets: `pnpm changeset` writes a file into `.changeset/`, `pnpm version` consumes those and updates `CHANGELOG.md`, `pnpm release` publishes. `.changeset/config.json` declares `fixed: [["@antdv/*", "@antdv/*"]]`, so bumping **any** package moves every `@antdv/*` to the same version — that is the price paid for inter-package imports never drifting apart.

## Keep reading

- Full package and directory inventory: [Project layout](/en/guide/project/dir)
- How env vars are read and why a switch stays false: [Local development](/en/guide/essentials/development), [Configuration](/en/guide/essentials/config)
- The four layers of routing: [Routes and menu](/en/guide/essentials/route)
- Request layer and API contract: [Server interaction](/en/guide/essentials/request)
- Utilities versus caching: [Utilities](/en/guide/essentials/utils), [Caching](/en/guide/essentials/cache)
- Running and building: [Quick start](/en/guide/introduction/quick-start), [Build and deploy](/en/guide/essentials/deploy)
