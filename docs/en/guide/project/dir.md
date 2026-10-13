# Directory structure

## The three layers

```
apps/       Deployable things: web (the admin app), backend-mock (Nitro), docs (this site)
packages/   Runtime sub-packages: they get bundled into the browser build output
internal/   Build-time tooling: runs in Node only, never enters the build output
```

The globs in `pnpm-workspace.yaml` are `internal/*`, `internal/lint-configs/*`, `packages/*`, `packages/ui-kit/*`, `apps/*`, `docs`, `scripts/*`. **New packages have to land in one of these directories**, otherwise they aren't recognized as workspace members (a root-level directory like `docs/` isn't — and `packages/ui-kit/foo` was not either until the glob gained that entry).

## The 18 runtime sub-packages

The old `@antdv/ui` split into three (`icons` / `loading-ui` / `scrollbar-ui`), and the TanStack-based wrapper layers plus the shadcn atoms each became their own package under `packages/ui-kit/`:

| Package | Responsibility | Boundary (no imports inside the package) |
| --- | --- | --- |
| `@antdv/types` | Shared type contracts: layout settings, menu, tab pages, Mock envelope | Types only, no runtime code |
| `@antdv/shared` | Cache, crypto, date, download, Excel, masking, XSS, event bus, menu helpers, `cn()` | store / api |
| `@antdv/preferences` | Preference defaults, persistence, writing CSS variables, antdv-next theme config | pinia / store |
| `@antdv/composables` | Composables: chunked upload, print, watermark, ECharts, SSE, WebSocket… | store / api / router instance |
| `@antdv/icons` | Icons only: the Iconify wrapper, the SVG-sprite icon, the icon picker (shadcn implementation) | pinia / vue-router / business stores / app config / antdv-next |
| `@antdv/loading-ui` | The `Loading` overlay + `useLoading` + the `createLoading` family + the `v-loading` directive | same as above (dependencies stop at `shadcn-ui` / `shared`) |
| `@antdv/scrollbar-ui` | The self-drawn `Scrollbar` + `Bar`; styles travel with the component, no host Tailwind | same as above |
| `@antdv/shadcn-ui` | shadcn-vue atoms (Dialog / Popover / Select / Spinner…), the implementation base of the packages above | business logic |
| `@antdv/form-ui` | Schema-driven forms on top of `@tanstack/vue-form`: `BasicForm` / `useForm` / `componentMap` | application store |
| `@antdv/table-ui` | `BasicTable` / `useTable` + hooks on top of `@tanstack/vue-table` | application store |
| `@antdv/popup-ui` | Dialog / Drawer / AlertDialog wrappers plus `useModal` / `useDrawer` | application store |
| `@antdv/tabs-ui` | Tab pages: `TabList` / `TabItem` / `TabActions` / context menu + the layout shell | pinia / vue-router |
| `@antdv/menu-ui` | Menu tree rendering and collapse state | pinia / vue-router |
| `@antdv/layout-ui` | The region components for the 7 layout shapes (sider, icon rail, header…) | pinia / vue-router |
| `@antdv/layouts` | Region blueprints for the 7 menu modes, content area width strategy, menu tree state source, breadcrumb derivation | pinia / vue-router |
| `@antdv/router` | Navigation guards: login check, dynamic menu registration, title, progress bar, permission filtering | store / api |
| `@antdv/directives` | `v-permission`, `v-lazy` | store / pinia / vueuse |
| `@antdv/styles` | Tailwind v4 entry, base layer, NProgress, accessibility and permission fallback styles | CSS only, no component logic |

::: tip Why every table has an extra "no imports" column This is the only reason these packages can be reused on their own in customer projects. Everywhere that needs to read user permissions / fetch the menu / look at preferences gets a function or ref passed in through **dependency injection** — the package itself knows nothing about pinia. So the packages stay plain TS + Vue composables, can be unit tested outside the app, and never form the "store imports the package, the package imports the store back" cycle. When adding a capability, settle this boundary first, then decide whether it goes in the app or in a sub-package — thin shells that need store stay in `apps/web`. :::

## Dependency direction

```
internal/*  ──►  Used by apps/packages at build time only
apps/web    ──►  packages/*, packages/ui-kit/* (runtime)
packages/*  ──►  packages/*, and it must stay one-way (types ← every other package)
```

Cycles are pinned by `pnpm check:circular` in CI (`vsh check-circular`, backed by `circular-dependency-scanner`); `pnpm check:dep` checks dependency declaration conventions, `pnpm publint` checks the packages' publishable build output, and `knip` finds unused dependencies and exports.

## Where versions come from: catalog

Dependency versions are written once in the `catalog:` of `pnpm-workspace.yaml`, and sub-packages always write `"vue": "catalog:"`:

- Upgrading a third-party library means changing one place only, so you never get type clashes like "vue 3.5.40 in package A, 3.5.43 in package B";
- `vue` is **pinned exactly** (`3.5.43`, no `^`): keeping the caret lets some third-party peer trees stall on an older 3.5.x, which puts two copies of the `@vue/runtime-core` types in the build and makes passing a `Directive` across packages clash outright;
- Real exceptions do exist and use a grouped catalog such as `catalogs.conflicts_vue_h3_5_43`;
- `overrides` forces `@ctrl/tinycolor`, `clsx`, `pinia`, and `vue` to converge on the catalog version.

Internal packages reference each other with `workspace:*`, which installs as a symlink, so changes take effect immediately — but how far that "effect" reaches depends on whether the package on the other end is dist-published or source-published (see below).

## Build: tsdown + turbo (two kinds of package)

- **dist-published packages** (`shared` / `composables` / `directives` / `layouts` / `preferences` / `router` / `types` / `node-utils` / `vite-config`): their `build` is just `tsdown` (the Rolldown family), the output lands in `dist/` and `files` ships `dist` only; `exports` supports **subpath modules** — `@antdv/shared/cn` → `dist/cn.js` (via the `./*` wildcard), while multi-file directory modules (`cache` / `crypto` / `event`) are listed explicitly. `apps/web` reads these packages' `dist`, so after changing their `src` you must rebuild and restart dev to see anything.
- **source-published packages** (`icons` / `styles` / the nine under `ui-kit`): `files: ["src"]`, `main`/`types` point straight at `./src/index.ts`, and there is **no build script** — the host Vite compiles them. Saving an edit hot-reloads with no rebuild, but the host must be able to compile `.vue` files and the Tailwind entry. The full account is in [External modules](/en/guide/essentials/external).
- The task graph in `turbo.json`: `build` / `type-check` / `test:unit` / `test:e2e` all carry `dependsOn: ["^build"]`, i.e. "build my dependencies first"; `dev` is `persistent`, never cached, and likewise runs after `^build` (packages with no build script simply skip that step).

## Publishing: changesets

```bash
pnpm changeset          # declare which packages this change touches and at what bump level
pnpm version            # consume the changesets, bump versions, write CHANGELOG.md, then install to sync the lockfile
pnpm release            # build + changeset publish
```

Three fields in `.changeset/config.json` decide the actual behavior:

- `changelog: @changesets/changelog-github` + `repo` — every CHANGELOG entry carries a PR link;
- `fixed: [["@antdv/*", "@antdv/*"]]` — **all `@antdv/*` packages bump in lockstep**, so a patch on any one takes everyone to the same version (which is why every package is on `0.4.0` right now). This is deliberate: the internal packages reference each other, and scattered versions would turn "which versions can be installed together and still run" into a puzzle;
- `privatePackages: { version: true, tag: true }` — the `private: true` packages `@antdv/web` / `docs` / `backend-mock` get version bumps and tags as well, even though they aren't published to npm.

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
