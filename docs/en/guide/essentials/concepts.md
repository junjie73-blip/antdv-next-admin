# Core concepts

This page answers "why the code sits where it sits": which layer an artifact belongs to, what that layer is allowed to import, what you have to do after editing it, and which naming and path conventions are enforced. The rules themselves live in `CODE_STANDARD.md` and in the "key constraints" note of `README.md`; here they are matched against the actual code.

## Four layers

```
apps/web/          @antdv/web — the admin app, the only entry the browser executes
apps/backend-mock/ Nitro mock, started in-process during dev; API handlers and menu seed data
docs/              the VitePress site (@antdv/docs), a sibling of apps/, not part of the app build
packages/          9 runtime packages: they end up inside the browser bundle
internal/          build-time tooling: runs only in Node, never shipped (vite-config / lint-configs / tsconfig / node-utils)
scripts/           repository tasks (vsh, turbo-run, clean, deploy)
```

The split is not "does this look like a library", it is **who consumes the artifact**. `internal/vite-config` produces `defineApplicationConfig()`, called exactly once from `apps/web/vite.config.ts`; `packages/shared` produces ESM that Vite consumes directly. That is why `turbo.json` puts `dependsOn: ["^build"]` on both `dev` and `build` — upstream packages emit `dist` before a downstream task runs.

## Two publish shapes, two ways to make an edit take effect

| Shape | Packages | `main` points at | After editing `src` |
| --- | --- | --- | --- |
| dist-published | `@antdv/shared`, `composables`, `directives`, `layouts`, `preferences`, `router`, `types` | `./dist/index.js` (tsdown output) | run `pnpm --filter @antdv/shared build`, then restart dev |
| source-published | `@antdv/icons`, `@antdv/design` and the ten `@antdv/ui-kit` packages (`common-ui` / `shadcn-ui` / `form-ui` / `table-ui` / `popup-ui` / `layout-ui` / `menu-ui` / `tabs-ui` / `loading-ui` / `scrollbar-ui`) | `./src/index.ts` (`design`: `./src/index.css`) | hot-reloads, there is no build step |

Evidence: the `main` field of each `packages/*/package.json` and `packages/ui-kit/*/package.json`, plus `packages/shared/tsdown.config.ts` (`entry: ['src/index.ts', 'src/*.ts', 'src/*/index.ts']`). The dist-published ones are the packages that have a `build` script; their `dev` script is `tsdown --watch`.

::: warning You edited a dist-published package and nothing changed This is the most common "I clearly changed it" in this repository. Vite's dependency cache and `optimizeDeps` both point at `dist`, so `src` is simply not in the build graph. You edit, save, and see nothing — and get no error either. :::

Being source-published has a cost: those packages have no `build` script at all (`packages/icons/package.json` only defines `clean` / `test:unit` / `type-check`), and their `<script setup>` blocks are compiled by the app's `@vitejs/plugin-vue`. So they cannot be consumed outside a Vite build.

## Package boundaries: no stores, no env

Nothing under `packages/*` may import `pinia`, an app store, or read `import.meta.env`. Two concrete reasons, not aesthetic preference:

1. **Package output lives in `dist`, out of reach of Vite's env static replacement.** Reading `import.meta.env` inside a package yields `undefined` and the behavior degrades silently. The app injects its environment instead: `apps/web/src/bootstrap/env.ts` calls `configureSharedEnv({ cachePrefix, cacheEncryptKey, ... })`, and `packages/shared/src/env.ts` holds that explicit config. Preferences work the same way — the project-specific defaults are passed into `createPreferences({ defaults })` from `apps/web/src/settings/index.ts`.
2. **Unit tests need to flip branches.** A check like `shouldEncrypt()` ("encrypt only in production") is untestable when it reads env, and testable when it reads injected config — which is exactly what `packages/shared/__tests__/cache.test.ts` does.

"No stores" is enforced with dependency injection:

| Capability needed | What the package exposes | Where the app injects it |
| --- | --- | --- |
| Permission checks | `createPermissionDirective({ checkers, onCheck, subscribe })` (`packages/directives`) | `apps/web/src/directives/index.ts` |
| Route guards | guard factories in `@antdv/router` (auth state, menu loading, progress bar, title are all parameters) | `apps/web/src/router/guards/index.ts` |
| Layout shapes | `@antdv/layouts` ships only the region blueprint, no SFCs | `apps/web/src/layouts/` |

The one exception is `packages/shared/src/menu.ts`, which imports a **type** from `vue-router` (`import type { RouteRecordRaw }`). Types never reach the output, so the boundary holds.

::: tip Where new code goes Relevant to one page only → inside that page's `views/<module>/<page>/` directory. App-wide but app-specific (stores, api, ws) → the matching folder under `apps/web/src/`. Pure functions that another project could reuse → `packages/shared` or `packages/composables`. Requires pinia, the router, or backend data to work → keep a thin shell in the app and let the package receive the capability as an argument. :::

## Aliases and auto-import

There are exactly two aliases, and both sides must agree:

| Alias | Resolves to | Declared in |
| --- | --- | --- |
| `~` | `apps/web/src` | `internal/vite-config/src/config/common.ts:16-25` and the `paths` block of `apps/web/tsconfig.app.json` |
| `#` | `apps/web/types` | same two places |

If the two drift apart, Vite runs but `vue-tsc` errors (or the reverse), so the aliases are defined once inside `createAliases()`. The same function sets `resolve.dedupe: ['pinia', 'vue', 'vue-router']` — pnpm's peer resolution once left both `vue` 3.5.42 and 3.5.43 types in the tree (the catalog now pins `vue` to `3.5.43`), and two Vue runtimes make `inject` and the reactivity system blind to each other.

Auto-import covers **framework APIs — not this repository's packages and not antdv-next** (`internal/vite-config/src/plugins/auto-import.ts:48-54`):

- `AutoImport` (`:48-51`): `vue`, `@vueuse/core`, `pinia`, `VueRouterAutoImports`. The four functional entry points of `antdv-next` (`message`, `notification`, `Modal`, `Drawer`) used to be listed here; they have been **removed** — import them yourself.
- `Components` (`:52-54`): **no resolvers at all**. It used to carry three — `AntdvNextResolver` (`a-*`), `AntdvUiResolver` (the sub-package components) and `IconifyResolver` (bare `<Icon>`) — and all three channels are now closed. The plugin keeps only its built-in behaviour: scan the app's `src/components` directory so local components need no import.
- The generated declarations `apps/web/types/auto-imports.d.ts` and `components.d.ts` are committed. Plugins rewrite them during the build, and on a Windows mapped drive that write occasionally fails with `UNKNOWN (errno -4094)` and takes the dev server down, hence the `VITE_WRITE_DTS=false` escape hatch (see the comments in the same file).

Consequence: components and component-library APIs are **always imported explicitly**, in 100+ app files:

```ts
import { Card as ACard, message } from 'antdv-next';
import { Scrollbar } from '@antdv/scrollbar-ui';
import { Icon } from '@iconify/vue';
```

`<script setup>` looks template bindings up by `capitalize(camelize(tag))`, so to keep writing `<ACard>` you alias the named export to `ACard` (`import { Card }` only pairs with `<Card>`). The `vue/component-name-in-template-casing` rule rewrites kebab tags to PascalCase, which lines up with exactly that.

Bare `useRoute()` and `ref()` are what auto-import still handles; subpath imports such as `import { cn } from '@antdv/shared/cn'` you also write by hand.

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
