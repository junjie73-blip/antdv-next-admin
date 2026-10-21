# Directory structure

## The three layers

```
apps/       Deployable things: web (the admin app), backend-mock (Nitro), docs (this site)
packages/   Runtime sub-packages: they get bundled into the browser build output
internal/   Build-time tooling: runs in Node only, never enters the build output
```

The globs in `pnpm-workspace.yaml` are `internal/*`, `internal/lint-configs/*`, `packages/*`, `packages/core/*`, `packages/core/base/*`, `packages/core/ui-kit/*`, `apps/*`, `docs`, `scripts/*`. **New packages have to land in one of these directories**, otherwise they are not recognized as workspace members.

## The 21 runtime sub-packages

The old `@antdv/ui` was taken apart completely: the icons went to `packages/core/base/icons`, and Loading and Scrollbar merged into `packages/core/ui-kit/common-ui` together with the shared display components; the TanStack-based wrapper layers and the shadcn atoms each became their own package under `packages/core/ui-kit/` (8 of them). The "location" column of the 21 rows below is exactly what the globs above resolve to:

| Package | Responsibility | Boundary (no imports inside the package) |
| --- | --- | --- |
| `@antdv/types` (`core/base/typings`) | Shared type contracts: layout settings, menu, tab pages, Mock envelope | Types only, no runtime code |
| `@antdv/shared` (`core/base/shared`) | Four directories plus one entry: `cache` (including SM4 encryption), `color` (colour conversions), `constants` (cross-layer literals: CSS variable names in `css-vars.ts`, DOM classes, the default primary colour), `utils` (one file per tool — `cn`, dates, download, Excel, masking, XSS, event bus…), and `store.ts`, which only re-exports `@tanstack/vue-store` | store / api |
| `@antdv/design` (`core/base/design`) | Two second-level directories: `token/` (a `default` and a `dark` set of shadcn variables plus the `@theme inline` mapping) and `css/` (base layer, NProgress, accessibility, permission fallback, scrollbar fallback), assembled by the Tailwind v4 entry `src/index.css` | variables and CSS only, no component logic |
| `@antdv/icons` (`core/base/icons`) | Icons only: the Iconify wrapper, the SVG-sprite icon, the icon picker (shadcn implementation); the five `@iconify-json/*` collections are declared in this package's `dependencies` | pinia / vue-router / business stores / app config / antdv-next |
| `@antdv/hooks` (`core/hooks`) | Composables: `use-cache`, `use-chunk-upload`, `use-crud`, `use-file-reader`, `use-permission`, `use-print`, `use-route-loading`, `use-watermark`, plus the `echarts/` sub-entry | store / api / router instance |
| `@antdv/preferences` (`core/preferences`) | Preference defaults (`src/config.ts`), persistence, `applyPreferencesToDom()` writing to the DOM (`src/update-css-variables.ts`), the startup theme snapshot (`src/boot-theme.ts`) | pinia / store; **it knows neither antd nor any component library** — preferences land directly as `--primary` / `--radius` / `--font-size` / `--filter` on `<html>`, there is no "preferences → `ThemeConfig`" translation layer any more (the `apps/web/src/settings/theme/` directory that used to do it was deleted along with antd) |
| `@antdv/common-ui` (`core/ui-kit/common-ui`) | Shared display components and shells: `Loading` + `useLoading` / `createLoading`, the self-drawn `Scrollbar` (that one component only — there is no separate `Bar`), `Alert`, `Badge`, `BorderBeam`, `Card`, `CountTo`, `CronEditor`, `Description(s)`, `Divider`, `Empty` / `EmptyState`, `ErrorBoundary`, `Image`, `Listy`, `MarkdownEditor`, `PageSkeleton` / `TableSkeleton`, `Popconfirm`, `Result`, `Segmented`, `Space`, `Statistic`, `StatusTag`, `Steps`, `Tabs` / `TabPane`, `Tag`, `Timeline`, `Toaster`, `Tooltip`, `Transfer`, `Tree`, `Upload`, the login-page shells `AuthPageLayout` / `AuthFormPanel` / `AuthColorPresets`, `ConfigProvider` — all composed from `@antdv/shadcn-ui` primitives | application store / api |
| `@antdv/shadcn-ui` (`core/ui-kit/shadcn-ui`) | shadcn-vue atoms (Dialog / Popover / Select / Spinner…), the implementation base of the packages above | business logic |
| `@antdv/form-ui` (`core/ui-kit/form-ui`) | Schema-driven forms on top of `@tanstack/vue-form`: `BasicForm` / `useForm` / `componentMap` | application store |
| `@antdv/table-ui` (`core/ui-kit/table-ui`) | `BasicTable` / `useTable` + hooks on top of `@tanstack/vue-table` | application store |
| `@antdv/popup-ui` (`core/ui-kit/popup-ui`) | Modal / Drawer / confirm wrappers plus `useModal` / `useDrawer` / `message` (the vue-sonner bridge) | application store |
| `@antdv/tabs-ui` (`core/ui-kit/tabs-ui`) | Tab pages: `TabList` / `TabItem` / `TabActions` / context menu | pinia / vue-router |
| `@antdv/menu-ui` (`core/ui-kit/menu-ui`) | Menu tree rendering and collapse animation | pinia / vue-router |
| `@antdv/layout-ui` (`core/ui-kit/layout-ui`) | The region components for the 7 layout shapes (`LayoutMode`: `packages/core/base/typings/src/app.ts:20-26`) — sider, icon rail, header… | pinia / vue-router |
| `@antdv/layouts` (`packages/layouts`) | Region blueprints for the 7 menu modes, content area width strategy, the menu tree state source (`src/hooks/use-menu-tree.ts`), breadcrumb derivation, header widgets | pinia / vue-router |
| `@antdv/router` (`packages/router`) | Navigation guards: login check, dynamic menu registration, title, progress bar, permission filtering | store / api |
| `@antdv/directives` (`packages/directives`) | `v-permission`, `v-lazy` | store / pinia / vueuse |
| `@antdv/stores` (`packages/stores`) | Four setup stores (`app` / `route` / `tabs` / `user`) plus `session.ts`, the session-invalidation registry | depends only on packages such as `@tanstack/vue-store`; never imports a router instance |
| `@antdv/request` (`packages/request`) | The layer above `createFetch`: Bearer / CSRF / retry / 401 refresh, plus the `sse/` and `websocket/` managers | pinia / application store |
| `@antdv/utils` (`packages/utils`) | App-agnostic pure functions: `menu.ts` (`attachMenuPaths` / `localizeMenus`), `theme-mode.ts` (`resolveThemeMode`) | anything stateful |
| `@antdv/enums` (`packages/enums`) | Cross-layer enums and literals: `CacheKey`, dictionary-related constants | any runtime dependency |

::: tip

Why every table has an extra "no imports" column This is the only reason these packages can be reused on their own in customer projects. Everywhere that needs to read user permissions / fetch the menu / look at preferences gets a function or ref passed in through **dependency injection** — the package itself knows nothing about pinia. So the packages stay plain TS + Vue composables, can be unit tested outside the app, and never form the "store imports the package, the package imports the store back" cycle. When adding a capability, settle this boundary first, then decide whether it goes in the app or in a sub-package — thin shells that need store stay in `apps/web`. :::

## Dependency direction

```
internal/*  ──►  Used by apps/packages at build time only
apps/web    ──►  packages/*, packages/core/ui-kit/* (runtime)
packages/*  ──►  packages/*, and it must stay one-way (types ← every other package)
```

Cycles are pinned by `pnpm check:circular` (`vsh check-circular`, backed by `circular-dependency-scanner`) — note this is a **manual / local** gate, because `.github/workflows/` contains only `docs.yml` and CI never runs it; `pnpm check:dep` checks dependency declaration conventions, `pnpm publint` checks the packages' publishable build output, and `knip` finds unused dependencies and exports.

## Where versions come from: catalog

Dependency versions are written once in the `catalog:` of `pnpm-workspace.yaml`, and sub-packages always write `"vue": "catalog:"`:

- Upgrading a third-party library means changing one place only, so you never get type clashes like "vue 3.5.40 in package A, 3.5.43 in package B";
- `vue` is **pinned exactly** (`3.5.43`, no `^`): keeping the caret lets some third-party peer trees stall on an older 3.5.x, which puts two copies of the `@vue/runtime-core` types in the build and makes passing a `Directive` across packages clash outright;
- Real exceptions do exist and use a grouped catalog such as `catalogs.conflicts_vue_h3_5_43`;
- `overrides` forces `@ctrl/tinycolor`, `clsx`, `pinia`, and `vue` to converge on the catalog version.

Internal packages reference each other with `workspace:*`, which installs as a symlink, so changes take effect immediately — but how far that "effect" reaches depends on whether the package on the other end is dist-published or source-published (see below).

## Build: tsdown + turbo (two kinds of package)

- **dist-published packages** (the 6 runtime ones: `shared` / `types` / `hooks` / `preferences` / `router` / `directives`; the build-time `node-utils` / `vite-config` work the same way): their `build` is just `tsdown` (the Rolldown family), the output lands in `dist/` and `files` ships `dist` only; `exports` supports **subpath modules** — `@antdv/shared/utils/cn` → `dist/utils/cn.js` (via the `./*` wildcard), while multi-file directory modules (`cache` / `color` / `constants` / `utils` plus `utils/crypto` and `utils/event`) are listed explicitly. `apps/web` reads these packages' `dist`, so after changing their `src` you must rebuild and restart dev to see anything.
- **source-published packages** (the 15 runtime ones): the eight under `ui-kit`, plus `design`, `icons`, `layouts`, `request`, `stores`, `utils`, `enums`. `files: ["src"]`, `main`/`types` point straight at `./src/index.ts` (`design`: `./src/index.css`), and there is **no build script** — the host Vite compiles them. Saving an edit hot-reloads with no rebuild, but the host must be able to compile `.vue` files and the Tailwind entry. The full account is in [External modules](/en/guide/essentials/external).
- The task graph in `turbo.json`: `build` / `type-check` / `test:unit` / `test:e2e` all carry `dependsOn: ["^build"]`, i.e. "build my dependencies first"; `dev` is `persistent`, never cached, and likewise runs after `^build` (packages with no build script simply skip that step).

## Publishing: changesets

```bash
pnpm changeset          # declare which packages this change touches and at what bump level
pnpm version            # consume the changesets, bump versions, write CHANGELOG.md, then install to sync the lockfile
pnpm release            # build + changeset publish
```

Three fields in `.changeset/config.json` decide the actual behavior:

- `changelog: @changesets/changelog-github` + `repo` — every generated CHANGELOG entry carries a commit link; **no package has a `CHANGELOG.md` yet** (`pnpm version` has never run), and the one at the repository root is a leftover `standard-version` file from before the monorepo rework;
- `fixed: [["@antdv/*", "@antdv/*"]]` — **`@antdv/*` bumps in lockstep**: within one `pnpm version` run, the packages carried by the same batch of changesets jump to the same number. That is deliberate — the internal packages reference each other, and scattered versions would turn "which versions can be installed together and still run" into a puzzle. But lockstep is not equality: packages untouched by that batch keep their own number, so today (measured against each `package.json`) most are on `0.4.0`, `@antdv/layouts` is on `0.5.0`, `common-ui` / `enums` / `request` / `stores` / `utils` are still on `0.1.0`, the five `*-config` packages plus `docs` sit at `0.0.0`, and `scripts/`'s `turbo-run` / `vsh` carry the `5.8.0` inherited from the template. Do not write "every package is on the same version" in documentation;
- `privatePackages: { version: true, tag: true }` — all **34 workspace members** are `private: true` (including `@antdv/web`, `@antdv/backend-mock` and `@antdv/docs`), and this switch makes them take part in version bumps and tagging even though nothing is published to npm;
- `baseBranch: "main"`, `updateInternalDependencies: "patch"`, `linked: []`, `ignore: []`.

The previous `standard-version` setup was removed as part of the monorepo rework — a single repo-wide version number isn't enough for multiple packages.

## Build-time tooling (internal/)

| Package | What it does |
| --- | --- |
| `@antdv/vite-config` | `defineApplicationConfig()`: plugin assembly, aliases, chunking strategy, env parsing, dev proxy (including forwarding to the Nitro Mock), `__APP_INFO__` |
| `@antdv/node-utils` | Node-side fs / path / git / hash / workspace parsing plus terminal logging |
| `@antdv/tsconfig` | Shared TS config that sub-packages `extends` |
| `@antdv/eslint-config`, `oxlint-config`, `oxfmt-config`, `stylelint-config`, `commitlint-config` | Conventions as packages; the root config only assembles them |

So the app side keeps only the parts that are genuinely specific to this project:

```ts
// apps/web/vite.config.ts
import { defineApplicationConfig } from '@antdv/vite-config';

export default defineApplicationConfig({
  base: './',
});
```

`base: './'` + hash routing = the build output can be opened directly under any sub-path, which is also why it can be dropped as-is onto Vercel / nginx / static hosting.
