# External modules

"External modules" runs in two directions, and this page covers both: **pulling a third-party package into this repository**, and **handing a package from this repository to another project**. In between sits the distinction most often muddled — whether a given external module ends up in the browser bundle at all, and whether its components come from an explicit compile-time `import` or merely from a generated type file.

| What you want to do | The actual chain | Where to look |
| --- | --- | --- |
| Add a third-party dependency | `catalog:` in the root `pnpm-workspace.yaml` + `"catalog:"` in the consuming package | `pnpm-workspace.yaml:21-263` |
| Decide whether it ships to the browser | Which basket it sits in, plus the chunk-group rules | `apps/web/package.json:17-168`, `internal/vite-config/src/optimize.ts:1-36` |
| Use its components | An explicit `import` is the only route (the runtime `app.component` channel was taken apart) | `internal/vite-config/src/plugins/auto-import.ts:16-38` |
| Export an internal package | `exports` subpaths + `files: ["dist"]` + package boundaries + lockstep versions | `packages/core/base/shared/package.json:14-56`, `.changeset/config.json:10-17` |
| Embed an outside sub-app | Registry + `VITE_MICRO_APP` + iframe fallback | `apps/web/src/config/micro-app.ts:5-92` |

## 1. Adding a third-party dependency

### What gets touched, in order

| Step | Location | What to do | Evidence |
| --- | --- | --- | --- |
| 1 | `catalog:` in `pnpm-workspace.yaml` | Add `some-lib: ^1.2.3` — the only place versions live | `pnpm-workspace.yaml:21-263` (241 entries today) |
| 2 | Consuming `package.json` | Write `"some-lib": "catalog:"`, **never a literal range** | `apps/web/package.json:17-104` is entirely `catalog:` / `workspace:*` |
| 3 | Pick the basket | Node-only (Vite plugin, CLI) → `devDependencies` (`:106-168`); anything the browser executes → `dependencies` (`:17-104`) | `apps/web/package.json:106-168` |
| 4 | `pnpm install` **from the repo root** | Regenerate `pnpm-lock.yaml`; the docs CI runs a bare `pnpm install` (`.github/workflows/docs.yml:47`), so a stale lockfile does not fail outright — it just installs a tree that differs from everyone else's | `.github/workflows/docs.yml:35-49` |
| 5 | `overrides` only when needed | Add an entry only once you see a duplicated instance of the same package | `pnpm-workspace.yaml:292-297` |

::: warning

`pnpm add` does not write `catalog:` for you `pnpm-workspace.yaml` has **no** `useCatalog` key (its complete key list is `packages`, `allowBuilds`, `autoInstallPeers`, `catalog`, `catalogs`, `dedupePeerDependents`, `ignoredBuiltDependencies`, `minimumReleaseAge`, `onlyBuiltDependencies`, `overrides`, `publicHoistPattern`, `strictPeerDependencies`, `verifyDepsBeforeRun`). So `pnpm add some-lib` drops a literal range into `package.json`, and step 2 is a manual edit: add the line under `catalog:`, then change the package entry to `"catalog:"`. Three packages got away with literals — see the warning below. :::

### The shortest reproducible procedure

```bash
# all of this runs from the repo root
# 1) pnpm-workspace.yaml: add `some-lib: ^1.2.3` under catalog:
# 2) apps/web/package.json: add `"some-lib": "catalog:"` under dependencies
pnpm install                    # root `postinstall` runs `pnpm -r run --if-present stub`
pnpm --filter @antdv/web type-check
pnpm check:dep                  # knip: proves the package is actually imported
```

Why step 4 belongs **at the repo root**: `catalog:`, `overrides` and `pnpm-lock.yaml` are all workspace-level artefacts, so installing from inside `apps/web/` only produces a tree that is out of sync with the root catalog. On top of that, `verifyDepsBeforeRun: false` (`pnpm-workspace.yaml:311`) disables the "is node_modules in sync with the lockfile" check before every script — edit `catalog:`, skip the install, and your next command silently runs against the old tree with no error.

Internal packages always reference each other with `workspace:*` (e.g. `apps/web/package.json:18-35`), which installs as a symlink. A new package only becomes a workspace member if it lands inside one of the declared globs (`pnpm-workspace.yaml:1-10` — `docs` is the one deliberately listed by name at `:9`).

### Two convergence lists beside `catalog:`

| List | Entries | Effect |
| --- | --- | --- |
| `overrides` | `@ast-grep/napi`, `@ctrl/tinycolor`, `clsx`, `pinia`, `vue` → `catalog:` (`pnpm-workspace.yaml:292-297`) | Forces third-party peer trees onto the same single version |
| Peer behaviour | `dedupePeerDependents: true`, `autoInstallPeers: true`, `strictPeerDependencies: false` (`:268`, `:19`, `:309`) | Dedupe peers, auto-install missing ones, never abort on peer conflicts |
| Toolchain pins | `packageManager: pnpm@10.12.4` (root `package.json`), `.node-version` = `24.0.0`, `engines.node >= 22.0.0` | Bump these deliberately, never while touching a dependency |

`vue` in `catalog:` is a **pinned exact value**, `3.5.43` (`pnpm-workspace.yaml:229`) — leaving a caret lets some third-party peer trees stay on an older 3.5.x, which gives you two copies of the `@vue/runtime-core` types.

::: tip

What grouped catalogs are for — and the one this repo actually uses A named catalog holds a second version line for the same dependency: you define it under `catalogs.<name>` and it only takes effect where a package writes `"catalog:<name>"`. This repo declares exactly one, `catalogs.conflicts_vue_h3_5_43` (`pnpm-workspace.yaml:264-267`, `vue: ^3.5.43`), and `apps/web/package.json:95` writes precisely `"vue": "catalog:conflicts_vue_h3_5_43"` — so it is **live**: the app's own vue uses a caret range while the root catalog's exact `3.5.43` keeps governing every other package, and `overrides` pushes the third-party peer trees back onto the catalog. Three layers stacked still resolve to one vue instance (`resolve.dedupe` guards the runtime; see section 2). :::

::: warning

Do not write bare ranges in a sub-package The only dependency in the whole workspace that does not point at the root `catalog:` is `apps/web`'s `vue`, which goes through the named catalog. `clsx` and `pinia` were changed back to `"catalog:"` (`apps/web/package.json:67`, `:85`); the three historical literal ranges are gone. A new dependency should just write `"catalog:"` — reach for a named catalog only when a package genuinely must sit on a different version, and then define it and reference it in the same change. :::

## 2. What an external module costs in the browser bundle

### Start from the basket it sits in

| Basket | Examples | Reaches the browser |
| --- | --- | --- |
| `dependencies` of `apps/web` (87 entries, starting at `:17`) | `echarts`, `xlsx`, `pdfjs-dist`, `@antdv/*` | Yes — then split by the chunk rules below |
| `devDependencies` of `apps/web` (61 entries, starting at `:106`) | `vite`, `unplugin-auto-import`, `unplugin-vue-components`, `@antdv/vite-config` | No — Node side only |
| `internal/*` | `@antdv/vite-config`, `@antdv/node-utils`, the lint config packages | Build-time; the bundle only contains code they emit |

Source: `apps/web/package.json:146` and `:149` (the two unplugins), `:108` (`@antdv/vite-config`) and `:150` (`vite`) are devDependencies; `:97` (`vue-cropper`) is a dependency. This row used to hold `antdv-next` and `@antdv-next/auto-import-resolver` as well — the component library is now carried by `reka-ui` plus `@antdv/*`, and the resolver went away with the auto-import setup, so both entries and their catalog lines (`pnpm-workspace.yaml`) were deleted. **Whether something ships is decided by its basket plus whether anything imports it — not by how library-like its name looks.**

### Chunking: there is no `manualChunks` here, it is rolldown's `codeSplitting.groups`

Grepping `manualChunks` across the repo returns zero hits. The policy lives in `internal/vite-config/src/optimize.ts:1-36` and is attached by `createApplicationBuildConfig()` as `build.rolldownOptions.output.codeSplitting.groups` (`internal/vite-config/src/config/application.ts:40-43`), with `minSize` 20 KB (`:42`) and `js/[name]-[hash].js` naming for chunks and entries (`:39`, `:44`).

| Match (in source order) | Chunk | Line |
| --- | --- | --- |
| `vue` / `pinia` / `vue-router` | `vendor-vue` | `optimize.ts:9-14` |
| `echarts` | `vendor-echarts` | `:15` |
| `@vueuse` / `es-toolkit` / `dayjs` / `xlsx` | `vendor-utils` | `:16-22` |
| `@vue-office` | `vendor-office` | `:23` |
| `pdfjs-dist` | `vendor-pdfjs` | `:24` |
| `@intlify` / `vue-i18n` | `vendor-i18n` | `:25-26` |
| `highlight.js` | `vendor-highlight` | `:27` |
| `prosemirror` / `marked` | `vendor-editor` | `:28-29` |
| everything else under `node_modules` | `vendor` (fallback) | `:30` |

::: warning Four details worth knowing

- Every rule is a plain `id.includes(...)` **substring** test, gated by "the id is inside `node_modules`" (`optimize.ts:8`), and order is priority. So the `vue` rule (`:9-14`) scoops up every third-party path containing `vue`: `@vueuse/*`, `@vue-office/*` and `vue-i18n` are captured before they can reach `vendor-utils` / `vendor-office` / `vendor-i18n`, which in practice only apply to the names without `vue` (`es-toolkit` / `dayjs` / `xlsx`, `@intlify/*`). Code from `packages/*` is never grouped by this table either — its module ids do not live under `node_modules`.
- `debugName` (`:5-6`) exists for the bundle-size report: a function-valued `name` shows up as anonymous.
- Rules outlive their packages: `vendor-office` is still there although no `@vue-office/*` package is imported anymore (section 6). The rule itself costs nothing — just stop assuming an office chunk exists.
- The first row used to be `antdv-next` → `vendor-ui`; the whole rule went when the component library left. `@form-create/*` left in the same sweep, so `vendor-editor` (`:28-29`) now matches only `prosemirror` and `marked`. The fallback logic itself is unchanged: any third-party code that matches no named rule lands in `vendor` (`:30`). :::

### The two oddities in `optimizeDeps`

`createOptimizeDeps()` (`internal/vite-config/src/config/application.ts:59-66`, attached at `:97`):

```ts
// internal/vite-config/src/config/application.ts:60-65
return {
  exclude: ['vue'],
  // 必须是真实包名：写成裸的 '@vueuse' 会报
  // "Failed to resolve dependency: @vueuse, present in optimizeDeps.include"
  include: ['@vueuse/core', 'es-toolkit'],
};
```

- `exclude: ['vue']` keeps vue out of pre-bundling; the singleton is guaranteed by `resolve.dedupe` instead.
- The two `include` names warm the biggest first-screen dependencies so dev startup does not discover them on demand.
- The error quoted in the comment was really hit: an `include` entry written as a bare scope prefix (`@vueuse`) fails to resolve.

### Singletons, or "two copies of Vue"

`resolve.dedupe: ['pinia', 'vue', 'vue-router']` in `createCommonConfig()` (`internal/vite-config/src/config/common.ts:50`) is the runtime insurance policy. pnpm's peer resolution once produced both `@vue/runtime-core` 3.5.42 and 3.5.43 in one tree; the outcome was not only conflicting types but two Vue runtimes whose `inject` and reactivity systems cannot see each other. **After adding a dependency, if `provide` returns undefined or reactivity silently stops, suspect a second copy of vue before anything else.**

### One more thing that ships: `__APP_INFO__` embeds both dependency tables

`defineApplicationConfig()` injects `__APP_INFO__` by default: build timestamp plus the `dependencies` and `devDependencies` maps of the consuming `package.json`, serialized as-is (`internal/vite-config/src/config/application.ts:90-93`, `internal/vite-config/src/utils/package-json.ts:43-54`). `appInfo: false` turns it off.

::: warning

Nothing reads it A full-repo grep for `APP_INFO` hits only the injection sites, comments and one test case name: `application.ts:14` (the option's own doc comment), `application.ts:93` (the injection), `package-json.ts:27`, `package-json.ts:42` (a comment), `apps/web/vite.config.ts:10` (a comment), `internal/vite-config/__tests__/package-json.test.ts:33` (a test case name). No application code consumes it, so the "about page shows version and build time" promised by `package-json.ts:42` is not wired up. In other words: the bundle carries a free dependency inventory today. :::

### The channel that is not wired: CDN externals

`vite-plugin-cdn-import` is declared at `apps/web/package.json:152` but never imported — zero hits in `internal/vite-config` and in the application. So "external modules via CDN plus `rollupOptions.external`" **does not exist** in this repository; the `base: './'` output is a self-contained static directory, see [Build and deployment](/en/guide/essentials/deploy).

## 3. Explicit imports and type declarations are two layers

This section used to describe three: compile-time `import`, runtime `app.component`, and the generated `.d.ts`. The middle one existed for **pre-compiled** third-party templates such as `@form-create/antd-designer` — those resolve components at runtime through `resolveComponent('a-layout-sider')`, so an explicit import in our source cannot help them, which is why 36 `a-*` names were registered globally plus one `a-form-item-rest` pass-through placeholder. Once the designer was withdrawn, `apps/web/src/plugins/vendor-antd-components.ts` was deleted with it — the list and `registerVendorAntdComponents()` both gone. Two layers are left:

| Layer | Mechanism | When it acts | Whom it covers | Source |
| --- | --- | --- | --- | --- |
| Compile time | writing `import { FButton } from '@antdv/common-ui'` | the SFC compiler wires that local binding into the template | every component tag written **in this repository's source** | the guard test `apps/web/src/views/__tests__/gallery-api-usage.spec.ts:122` forbids the gallery pages from importing third-party component libraries at all |
| Types | `components.d.ts` / `auto-imports.d.ts` | Rewritten by the plugins during dev/build | TypeScript and the IDE only; proves nothing about usage | `internal/vite-config/src/plugins/index.ts:77-81` |

::: tip One runtime registration is left, for a different reason

`app.component('PdfViewer', VuePdfEmbed)` at `apps/web/src/main.ts:120` is today the only `app.component` call in the app. It does not register a UI atom but a large viewer that appears on a handful of pages; `vue-pdf-embed` is itself a pre-compiled package, so registering it under a global name removes the per-page import. The next line (`:121`) points `GlobalWorkerOptions.workerSrc` at the locally bundled `pdfjs-dist/build/pdf.worker.min.mjs?url` (`main.ts:13`), which is why that dependency gets its own `vendor-pdfjs` chunk (`optimize.ts:24`). :::

### Compile time: there is no resolver any more, components come from imports

`createAutoImportPlugins()` (`internal/vite-config/src/plugins/auto-import.ts:16-38`) used to register three resolvers: `AntdvNextResolver` (`a-*` → `antdv-next`), `AntdvUiResolver` (the sub-package components) and `IconifyResolver` (bare `<Icon>`). **All three are gone** (the file is 39 lines now and the explanatory comments went with them; the motivation is recorded in the commit history and in [Core concepts](/en/guide/essentials/concepts)):

- A bare tag has nobody to inject it at compile time, so the runtime leaves a single `Failed to resolve component` warning while the page renders an empty element — icons vanishing silently, the designer shell collapsing into empty tags; every such incident had to be traced back through the build configuration.
- Explicit imports make "what is used, and from where" visible in the file header, and subpath writes such as `import { cn } from '@antdv/shared/utils/cn'` finally match how components are imported.
- The sub-packages no longer assume the host ships an auto-import setup: another application can just install `@antdv/common-ui` or `@antdv/icons` and run.

The `Components` plugin itself stays (`:27-29`) but only with its built-in behaviour: scanning the app's own `src/components` directory for local registration, with no npm package involved — every application component now lives in an `@antdv/*` package, and the `[unplugin-vue-components] no components found` line printed at dev startup is the direct evidence. On the `AutoImport` side (`:23-26`) the auto-imported surface is framework APIs only: `vue`, `@vueuse/core`, `pinia`, `VueRouterAutoImports` — the four functional entry points from `antdv-next` (`message`, `notification`, `Modal`, `Drawer`) were removed from it too and must now be imported by hand.

One detail that bites: when `<script setup>` compiles a template it looks for a local binding named `capitalize(camelize(tag))`, so `<a-card>` needs the alias `ACard` and `<Card>` needs `Card`. With the resolvers gone, the app-wide convention is an explicit `import` plus a kebab-case tag, which lines up exactly with ESLint's `vue/component-name-in-template-casing`. There are no `a-*` tags left in application templates; pages and layouts all go through `@antdv/*` components.

### Types: `components.d.ts` is a scan artifact, and entry counts mean nothing

Line 6 of `apps/web/types/components.d.ts` reads `Generated by unplugin-vue-components`; line 2 is `@ts-nocheck`. It is a **list of tags the scanner saw**, and the two implications must be kept apart:

- It now contains **only `RouterLink` / `RouterView`** (typed from vue-router): after the resolvers were deleted the plugin no longer knows any third-party tag, and the local directory it scans is empty too. If you see `typeof import('antdv-next')[...]` you are looking at a dev server that has not been restarted (the old configuration is still in memory).
- No entry does not mean unusable. With `VITE_WRITE_DTS=false` the plugins skip both files (the switch is at `internal/vite-config/src/plugins/index.ts:77-81`, where `dts` is handed to `createAutoImportPlugins()`) and they stay at their previous state — and that single global registration never depended on this file anyway, since `app.component` goes through Vue's `GlobalComponents` interface.

Both files are committed (`git ls-files` shows them) and churn on every build, so do not read their diff as a semantic change. To know whether a given tag is really used, there is exactly one route: search for the tag in `apps/web/src`.

## 4. Handing `packages/*` to another project

### Subpaths are modules

`@antdv/shared` combines a wildcard with explicitly listed directory modules (`packages/core/base/shared/package.json:21-55`; the reason sits in the `//exports` comment at `:20`):

| Import | Resolves to | Uses in this repo |
| --- | --- | --- |
| `@antdv/shared/utils/cn` | `dist/utils/cn.js` (via the `"./*"` wildcard, `:50-53`, where `*` may contain a slash) | 462 |
| `@antdv/shared/cache` | `dist/cache/index.js` (listed explicitly, `:26-29`) | 14 |
| `@antdv/shared/utils/env` | `dist/utils/env.js` | 10 |
| `@antdv/request/websocket` | `src/websocket/index.ts` (listed explicitly, `packages/request/package.json:26`) | 3 files, but only 1 real import (`apps/web/src/utils/ws.ts:5`); the other two are comments (`packages/core/hooks/src/index.ts:17`, `packages/request/src/index.ts:4`) |

Build side: `packages/core/base/shared/tsdown.config.ts:16-22` declares `entry: ['src/index.ts', 'src/*.ts', 'src/*/*.ts', 'src/*/index.ts', 'src/*/*/index.ts']` with `platform: 'neutral'` (`:24`), and `files: ["dist"]` (`package.json:14-16`) is what decides that only `dist` travels.

Why many entries instead of one barrel: importing only `cn` should not pull the initialization of `xlsx` / `dompurify` into the graph (comment at `tsdown.config.ts:7-8`). `@antdv/request` follows the same rule — `sse` and `websocket` each carry their own set of manager classes and deliberately stay out of the barrel (`packages/request/package.json:21-28`, comment at `:20`), and the HTTP side opens one extra `./runtime` entry so the app can wire its injection points in (`:23`). `@antdv/common-ui` does the same: outside the barrel it opens only `./charts` (`packages/core/ui-kit/common-ui/package.json:24`), so ECharts stays out of the main entry.

::: tip

the wildcard entry belongs to `shared` only The `exports` of `@antdv/request`, `@antdv/utils` and `@antdv/common-ui` are **explicitly listed** whitelists with no `"./*"`. Adding a `src/foo.ts` to `packages/request` therefore does not automatically give you `@antdv/request/foo` — the `exports` map has to change too. Only `shared`'s directory modules enjoy the wildcard. :::

### Two publication shapes; the deciding question is whether it survives without Vite

| Shape | Packages | `main` | After editing `src` | Reusable outside |
| --- | --- | --- | --- | --- |
| dist-published | `shared`, `types`, `hooks`, `preferences`, `directives`, `router` | `./dist/index.js` (`types`: `./dist/index.mjs`) | Rebuild required | Yes, once `dist` exists |
| source-published | `@antdv/icons` (`./src/index.ts`), `@antdv/design` (`./src/index.css`), `@antdv/enums`, `@antdv/layouts`, `@antdv/request`, `@antdv/stores`, `@antdv/utils`, and the eight packages under `packages/core/ui-kit/` (`common-ui` / `shadcn-ui` / `form-ui` / `table-ui` / `popup-ui` / `layout-ui` / `menu-ui` / `tabs-ui`) | Points at `src` (e.g. `packages/core/ui-kit/common-ui/package.json:17-19`: `main/module/types` all point at `./src/index.ts`, with `files: ["dist", "src"]` at `:13-16`; `packages/utils/package.json` has the same shape) | Hot-updates immediately | The compiled artefact exists, the entry has not been switched over: all fifteen packages have a `build` (`vite build` + `defineLibraryConfig()`) and really do emit `dist`, but `exports["."]` still points at `./src/index.ts` — an external host resolves `.vue` files and the Tailwind entry, so it must bring its own compilation pipeline or repoint the entry at `dist` |

`loading-ui` and `scrollbar-ui` have been merged into `common-ui` (as `src/components/loading/` and `src/components/scrollbar/`), so the ui-kit top level went from ten packages to eight; the package name `@antdv/composables` is gone too — HTTP / SSE / WebSocket now live in `@antdv/request`.

### Package boundaries are the only reason these are reusable

`packages/*` may not import `pinia`, a router instance, an application store, or read `import.meta.env`; when such a capability is needed, the application **injects** it (guard factories, directive factories, preference defaults). Details and injection examples live in [Core concepts](/en/guide/essentials/concepts) and [Directory structure](/en/guide/project/dir); from the bundle's point of view one sentence is enough: **a package bound to a store cannot be installed anywhere else**, no matter how clean its `exports` are. The one accepted exception — `packages/utils/src/menu.ts` importing only `vue-router` _types_ — never reaches the output and does not break the boundary.

### Versions move in lockstep — but today nothing can actually be published

`fixed: [["@antdv/*", "@antdv/*"]]` (`.changeset/config.json:10`) makes every `@antdv/*` package jump to the same version whenever any one of them bumps, and `privatePackages: { version: true, tag: true }` (`:14-17`) lets private packages join that bump and tagging. **For a consumer this means you receive a set of versions that move together; pinning one of them alone is not a thing** (the flip side of `workspace:*` for internal references — see [Changeset](/en/guide/project/changeset)).

::: warning

There is no npm route right now `packages/*`, `internal/*`, `apps/*`, `docs` and `scripts/*` are **all** `"private": true` (checked file by file, e.g. `packages/core/base/shared/package.json:5`). `changeset publish` skips private packages, and `pnpm publint` (`vsh publint`) bails out at `scripts/vsh/src/publint/index.ts:166-168` with `if (pkgJson.private) return null;` — so this packaging check currently covers 0 packages. Practically, "give a package to another project" today means carrying the package directory (with its `dist`) out, or making it non-private first; `exports` and `files` are what makes either route work. :::

Whether an edit to `packages/*/src` shows up in the application depends on which publication shape the package has (table above): the six dist-published packages (`shared` / `types` / `hooks` / `preferences` / `directives` / `router`) are read from `dist` and need a rebuild, while the fifteen source-published ones hot-update immediately. `turbo.json:16-19` orders rebuilds with `build.dependsOn: ["^build"]`, and `dev` / `type-check` / `test:unit` / `test:e2e` carry the same `^build` (`:20-34`) — commands in [Quick start](/en/guide/introduction/quick-start).

### The library-mode build chain is wired; the publication side is not

`internal/vite-config/src/config/library.ts:215` exports `defineLibraryConfig()`, whose external list is `dependencies + peerDependencies` fully excluded (`internal/vite-config/src/utils/package-json.ts:63-71`; the comment at `:57-62` explains that bundling them would drag a second copy of vue in — size explosion plus a split reactivity system). All fifteen `vite build` packages — `@antdv/icons`, the eight under `packages/core/ui-kit/`, plus `layouts` / `request` / `stores` / `utils` / `enums` / `design` — now use it: a `vite.config.mts` of two lines, `import { defineLibraryConfig } from '@antdv/vite-config'` and `export default defineLibraryConfig()`, which compiles their SFCs and Tailwind entry into `dist`. The other six pure-TS packages build with tsdown. The criteria is `scripts.build` in `packages/**/package.json`; all 21 `@antdv/*` packages have one.

What is still missing is the entry switch: `exports["."]` points at `src` to keep this repository's dev HMR (see the table above), so publishing a real component library means repointing it at `dist` and wiring the artefact-shape check into `vsh publint` — a check that currently covers 0 packages because every one is private.

## 5. The other direction: external sub-apps and the upstream repository

### The micro-frontend registry

`apps/web/src/config/micro-app.ts:5-92` is a registry of six sub-apps (`name` / `url` / `baseroute` / `icon` / `loader` …). Its `enabled` flag goes through `isEnvEnabled(import.meta.env.VITE_MICRO_APP)` (`:7`) — writing `=== true` there is permanently false, because `import.meta.env` values are strings. The contract lives in `packages/core/base/typings/src/micro-app.ts`, where `loader` accepts only `'iframe' | 'webcomponent'` (`:21`). How routes match a `baseroute` is covered by [Routes and menu](/en/guide/essentials/route).

The `<micro-app>` tag is not treated as an unregistered component: the compiler is told to consider it a native custom element (`internal/vite-config/src/plugins/custom-elements.ts:21-24`, wired at `internal/vite-config/src/plugins/vue.ts:38-46`). Only the explicitly registered `micro-app` tag and the `micro-` prefix qualify, and a name must contain a hyphen (`custom-elements.ts:47-55`) — otherwise a genuine registration failure would be silently rendered as an empty tag.

::: warning

No micro-frontend SDK is installed `@micro-zoe/micro-app`, `wujie` and `qiankun` appear in zero `package.json` files. `<micro-app>` is a tag an SDK would define at runtime via `customElements.define()`; `SubAppView.vue:73` checks `!!window.microApp` for readiness and `:76` computes `useIframe = isExternalUrl || !isMicroAppReady`. With the current dependency set that expression is **always true**, so every path renders `<iframe>` (`:272-283`) and the `<micro-app>` branch (`:286-305`) is only there for a future SDK. The iframe `sandbox` omits `allow-same-origin` by default and opens it only for registry entries that declare `sameOrigin` (`:82-89`), and an enabled override shows a "same-origin preview" tag in the corner (`:316-322`). :::

### Upstream synchronization

`sync-upstream.json` names the upstream as `vbenjs/vue-vben-admin`, restricts `syncDirs` to `internal/lint-configs`, and keeps `previewMode: true`; `.sync-state.json` records the upstream OID of each synced file.

::: warning

`pnpm sync-upstream` is broken The root `package.json` entry is `"sync-upstream": " sync-upstream"` — it only names a command of the same spelling. That command is neither in `node_modules/.bin` nor in `pnpm-lock.yaml` (both greps return nothing), so it cannot run as written. Do not expect it to pull upstream code. :::

## 6. External modules nobody uses anymore

This section is an inventory only — nothing is changed. Criteria: the package name is searched as a string in `apps/web/src`, `packages/**`, `internal/**` and `apps/backend-mock` (`*.ts` / `*.vue` / `*.mts`, `dist` excluded). Zero hits means "no direct import".

| Dependency | Declared at (`apps/web/package.json`) | Status |
| --- | --- | --- |
| `@videojs-player/vue`, `@videojs/http-streaming`, `video.js` | `:51`, `:52`, `:93` | The only page that used them, `views/components/video/`, is gone (nothing under that directory exists in `HEAD`; `git log -- apps/web/src/views/components/video` still shows the commits that removed it) |
| `@vue-flow/background`, `/controls`, `/core`, `/minimap` | `:53-56` | Appear only in `apps/web/package.json`; no flow page ever existed |
| `bpmn-js`, `bpmn-js-i18n-zh`, `bpmn-js-properties-panel`, `camunda-bpmn-moddle` | `:63-66` | Same — zero hits |
| `@vue-office/docx`, `/excel`, `/pdf`, `/pptx` | `:57-60` | `docx`/`excel` survive only as comments and "install it if the preview is blank" placeholder copy at `views/components/upload/index.vue:671`, `:1131-1166`; `pdf`/`pptx` lack even that. The `vendor-office` rule at `internal/vite-config/src/optimize.ts:23` is still in place |
| `codemirror`, `vue-codemirror`, `@codemirror/commands`, `/lang-javascript`, `/lang-sql`, `/lang-vue`, `/theme-one-dark` | `:39-43`, `:68`, `:96` | Zero hits — the editor is tiptap now, not CodeMirror |
| `nanoid`, `qrcode`, `resize-observer-polyfill`, `vue-demi`, `vue-virtual-scroller` | `:82`, `:86`, `:88`, `:98`, `:103` | Zero hits |
| `vite-plugin-cdn-import`, `@vitejs/plugin-legacy`, `vite-plugin-iconify-offline` | `:152`, `:129`, `:157` | Build plugins in devDependencies with no import anywhere (`@vitejs/plugin-legacy` is declared a second time at `internal/vite-config/package.json:37`, also unused). Same batch as the warning at the end of [Configuration](/en/guide/essentials/config) |

::: warning

Don't mistake `vite-plugin-iconify-offline` for the plugin in use The offline icon plugin actually imported is **`@tomjs/vite-plugin-iconify`** (`internal/vite-config/src/plugins/auto-import.ts:7`, used at `:30-32`), declared separately at `apps/web/package.json:115`. The better-matching name `vite-plugin-iconify-offline` (`:157`) is a different thing — zero hits. Likewise `@tiptap/*` has moved out of the app into `packages/core/ui-kit/common-ui/package.json:38-46`, and all nine of those entries **do** have imports (`src/components/markdown-editor/**`), so they are not in this table. :::

### How the tooling catches them

| Command | Actually runs | Details that matter |
| --- | --- | --- |
| `pnpm check:dep` | `vsh check-dep` → knip (pinned `knip: ^6.40.0` at `pnpm-workspace.yaml:170`) | Its config never lands on disk: it is inlined in `scripts/vsh/src/check-dep/index.ts:14-31`, written to `os.tmpdir()` and passed with `--include dependencies --reporter json` (`:92-98`, `:100-109`) — so it looks at **unused `dependencies`** only; unused devDependencies are outside what this command reports |
| `pnpm publint` | `vsh publint` → publint | Walks every workspace `package.json` (`scripts/vsh/src/publint/index.ts:39-52`) then returns early on private packages (`:166-168`) — with everything private in this repo, it reports nothing |
| `pnpm check:circular` | `vsh check-circular` | Cycles between packages; a different question from "unused" |
| `pnpm check` | circular + dep + type + cspell | The last link always fails (`cspell` is not a dependency of any package), see [FAQ](/en/guide/other/faq) |

::: warning

"Reported unused" is not "safe to remove" The inlined knip config carries an `ignoreDependencies` list (`scripts/vsh/src/check-dep/index.ts:17-29`: `playwright`, `rimraf`, `tailwindcss`, `@iconify/json`, plus the in-repo config packages `@antdv/{commitlint,eslint,oxfmt,oxlint,stylelint}-config` and `@antdv/{design,vite-config}`, which are only referenced at build time), `ignore` excludes `dist/**`, `docs/**`, `node_modules/**` and `public/**` (`:15`), and `ignoreWorkspaces` drops `internal/lint-configs/*` and `scripts/*` (`:30`). Conversely, a dependency pulled in only as someone else's peer is never visible as a first-party import. Every row therefore has to be settled by asking "who imports it, and whose peer needs it". The upgrade-side equivalent of this warning is in [Updating the project](/en/guide/other/project-update). :::

## Related pages

- [Core concepts](/en/guide/essentials/concepts) — layering, package boundaries, the full auto-import surface
- [Directory structure](/en/guide/project/dir) — package list, why `catalog:` exists, tsdown + turbo
- [Vite Config](/en/guide/project/vite) — the three-layer merge, plugin assembly, build switches
- [Configuration](/en/guide/essentials/config) — the two read paths for `VITE_*` and the variable list
- [Local development](/en/guide/essentials/development) — environment variables and day-to-day scripts
- [Quick start](/en/guide/introduction/quick-start) — install, run, and what to do after editing a shared package
- [Updating the project](/en/guide/other/project-update) — where versions are pinned and which install switches apply
- [Changeset](/en/guide/project/changeset) — the `fixed` / `privatePackages` release chain
- [Icons](/en/guide/essentials/icons) — the channel icons take once `resolveIcons` is off
- [Routes and menu](/en/guide/essentials/route) — how a sub-app's `baseroute` becomes a route
