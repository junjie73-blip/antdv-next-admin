# External modules

"External modules" runs in two directions, and this page covers both: **pulling a third-party package into this repository**, and **handing a package from this repository to another project**. In between sits the distinction most often muddled — whether a given external module ends up in the browser bundle at all, and whether its components are injected at compile time, registered at runtime, or merely listed in a generated type file.

| What you want to do | The actual chain | Where to look |
| --- | --- | --- |
| Add a third-party dependency | `catalog:` in the root `pnpm-workspace.yaml` + `"catalog:"` in the consuming package | `pnpm-workspace.yaml:19-273` |
| Decide whether it ships to the browser | Which basket it sits in, plus the chunk-group rules | `apps/web/package.json:17-125`, `internal/vite-config/src/optimize.ts:1-41` |
| Use its components | explicit `import` / runtime `app.component` / generated `.d.ts` — three different things | `apps/web/src/plugins/vendor-antd-components.ts:59-118` |
| Export an internal package | `exports` subpaths + `files: ["dist"]` + package boundaries + lockstep versions | `packages/core/base/shared/package.json:14-43`, `.changeset/config.json:10-17` |
| Embed an outside sub-app | Registry + `VITE_MICRO_APP` + iframe fallback | `apps/web/src/config/micro-app.ts:5-92` |

## 1. Adding a third-party dependency

### What gets touched, in order

| Step | Location | What to do | Evidence |
| --- | --- | --- | --- |
| 1 | `catalog:` in `pnpm-workspace.yaml` | Add `some-lib: ^1.2.3` — the only place versions live | `pnpm-workspace.yaml:19-273` (254 entries today) |
| 2 | Consuming `package.json` | Write `"some-lib": "catalog:"`, **never a literal range** | `apps/web/package.json:17-125` is almost entirely `catalog:` |
| 3 | Pick the basket | Node-only (Vite plugin, CLI) → `devDependencies`; anything the browser executes → `dependencies` | `apps/web/package.json:126-190` vs `:17-125` |
| 4 | `pnpm install` **from the repo root** | Regenerate `pnpm-lock.yaml`; CI installs with `--frozen-lockfile`, so a stale lockfile fails outright | `.github/workflows/docs.yml:56` |
| 5 | `overrides` only when needed | Add an entry only once you see a duplicated instance of the same package | `pnpm-workspace.yaml:303-308` |

::: warning `pnpm add` does not write `catalog:` for you `pnpm-workspace.yaml` has **no** `useCatalog` key (its complete key list is `packages`, `allowBuilds`, `autoInstallPeers`, `catalog`, `catalogs`, `dedupePeerDependents`, `ignoredBuiltDependencies`, `minimumReleaseAge`, `onlyBuiltDependencies`, `overrides`, `publicHoistPattern`, `strictPeerDependencies`, `verifyDepsBeforeRun`). So `pnpm add some-lib` drops a literal range into `package.json`, and step 2 is a manual edit: add the line under `catalog:`, then change the package entry to `"catalog:"`. Three packages got away with literals — see the warning below. :::

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

Internal packages always reference each other with `workspace:*` (e.g. `apps/web/package.json:21-38`), which installs as a symlink. A new package only becomes a workspace member if it lands inside one of the declared globs (`pnpm-workspace.yaml:1-8` — `docs` is the one deliberately listed by name).

### Two convergence lists beside `catalog:`

| List | Entries | Effect |
| --- | --- | --- |
| `overrides` | `@ast-grep/napi`, `@ctrl/tinycolor`, `clsx`, `pinia`, `vue` → `catalog:` (`pnpm-workspace.yaml:293-297`) | Forces third-party peer trees onto the same single version |
| Peer behaviour | `dedupePeerDependents: true`, `autoInstallPeers: true`, `strictPeerDependencies: false` (`:268`, `:17`, `:309`) | Dedupe peers, auto-install missing ones, never abort on peer conflicts |
| Toolchain pins | `packageManager: pnpm@10.12.4` (root `package.json`), `.node-version` = `24.0.0`, `engines.node >= 22.0.0` | Bump these deliberately, never while touching a dependency |

`vue` in `catalog:` is a **pinned exact value**, `3.5.43` (`pnpm-workspace.yaml:212`; the reason is in the comment at `:210-211` — leaving a caret lets some peer trees stay on an older 3.5.x, which gives you two copies of the `@vue/runtime-core` types).

::: tip What grouped catalogs are for — and why this repo's entry is inert A named catalog holds a second version line for the same dependency: you define it under `catalogs.<name>` and it only takes effect where a package writes `catalog(<name>)`. This repo declares exactly one, `catalogs.conflicts_vue_h3_5_43` (`pnpm-workspace.yaml:312-315`, `vue: ^3.5.43`), but **no `package.json` anywhere writes `catalog(conflicts_vue_h3_5_43)`** — so it takes part in nothing today. It becomes real only if some package genuinely needs a different vue. :::

::: warning Do not copy these three lines The entire workspace has just 3 dependencies outside the catalog: `clsx: ^2.1.1`, `pinia: ^3.0.4` and `vue: ^3.5.43` in `apps/web/package.json` (legacy). `overrides` pushes them back onto catalog values, so they read as ranges but install as pins. New dependencies should not imitate this. :::

## 2. What an external module costs in the browser bundle

### Start from the basket it sits in

| Basket | Examples | Reaches the browser |
| --- | --- | --- |
| `dependencies` of `apps/web` (107 entries) | `antdv-next`, `echarts`, `xlsx`, `pdfjs-dist`, `@antdv/*` | Yes — then split by the chunk rules below |
| `devDependencies` of `apps/web` (63 entries) | `vite`, `unplugin-auto-import`, `unplugin-vue-components`, `@antdv/vite-config` | No — Node side only |
| `internal/*` | `@antdv/vite-config`, `@antdv/node-utils`, the lint config packages | Build-time; the bundle only contains code they emit |

Source: `apps/web/package.json:168` and `:171` (the two unplugins) and `:129` (`@antdv/vite-config`) are devDependencies (the block starts at `:126`); `:81` (`antdv-next`) and `:117` (`vue-cropper`) are dependencies (the block starts at `:17`). This row used to hold `@antdv-next/auto-import-resolver` as well — once the resolvers were withdrawn it had no reference left, so its catalog entry (`pnpm-workspace.yaml`) was deleted with it. **Whether something ships is decided by its basket plus whether anything imports it — not by how library-like its name looks.**

### Chunking: there is no `manualChunks` here, it is rolldown's `codeSplitting.groups`

Grepping `manualChunks` across the repo returns zero hits. The policy lives in `internal/vite-config/src/optimize.ts:1-41` and is attached by `createApplicationBuildConfig()` as `build.rolldownOptions.output.codeSplitting.groups` (`internal/vite-config/src/config/application.ts:38-41`), with `minSize` 20 KB (`:40`) and `js/[name]-[hash].js` naming for chunks and entries (`:37`, `:42`).

| Match (in source order) | Chunk | Line |
| --- | --- | --- |
| `antdv-next` | `vendor-ui` | `optimize.ts:9` |
| `vue` / `pinia` / `vue-router` | `vendor-vue` | `:10-15` |
| `echarts` | `vendor-echarts` | `:16` |
| `@vueuse` / `es-toolkit` / `dayjs` / `xlsx` | `vendor-utils` | `:17-23` |
| `@vue-office` | `vendor-office` | `:24` |
| `pdfjs-dist` | `vendor-pdfjs` | `:25` |
| `@intlify` / `vue-i18n` | `vendor-i18n` | `:26-27` |
| `highlight.js` | `vendor-highlight` | `:28` |
| `@form-create` / `prosemirror` / `marked` | `vendor-editor` | `:29-34` |
| everything else under `node_modules` | `vendor` (fallback) | `:35` |

::: warning Three details worth knowing

- Every rule is a plain `id.includes(...)` **substring** test, gated by "the id is inside `node_modules`" (`optimize.ts:8`), and order is priority. So the `vue` rule (`:10-15`) scoops up every third-party path containing `vue`: `@vueuse/*`, `@vue-office/*` and `vue-i18n` are captured before they can reach `vendor-utils` / `vendor-office` / `vendor-i18n`, which in practice only apply to the names without `vue` (`es-toolkit` / `dayjs` / `xlsx`, `@intlify/*`). Code from `packages/*` is never grouped by this table either — its module ids do not live under `node_modules`.
- `debugName` (`:5-6`) exists for the bundle-size report: a function-valued `name` shows up as anonymous.
- Rules outlive their packages: `vendor-office` is still there although no `@vue-office/*` package is imported anymore (section 6). The rule itself costs nothing — just stop assuming an office chunk exists. :::

### The two oddities in `optimizeDeps`

`createOptimizeDeps()` (`internal/vite-config/src/config/application.ts:57-64`, attached at `:97`):

```ts
// internal/vite-config/src/config/application.ts:58-63
return {
  exclude: ['vue'],
  // 必须是真实包名：写成裸的 '@vueuse' 会报
  // "Failed to resolve dependency: @vueuse, present in optimizeDeps.include"
  include: ['@vueuse/core', 'antdv-next', 'es-toolkit'],
};
```

- `exclude: ['vue']` keeps vue out of pre-bundling; the singleton is guaranteed by `resolve.dedupe` instead.
- The three `include` names warm the biggest first-screen dependencies so dev startup does not discover them on demand.
- The error quoted in the comment was really hit: an `include` entry written as a bare scope prefix (`@vueuse`) fails to resolve.

### Singletons, or "two copies of Vue"

`resolve.dedupe: ['pinia', 'vue', 'vue-router']` in `createCommonConfig()` (`internal/vite-config/src/config/common.ts:50`) is the runtime insurance policy. pnpm's peer resolution once produced both `@vue/runtime-core` 3.5.42 and 3.5.43 in one tree; the outcome was not only conflicting types but two Vue runtimes whose `inject` and reactivity systems cannot see each other. **After adding a dependency, if `provide` returns undefined or reactivity silently stops, suspect a second copy of vue before anything else.**

### One more thing that ships: `__APP_INFO__` embeds both dependency tables

`defineApplicationConfig()` injects `__APP_INFO__` by default: build timestamp plus the `dependencies` and `devDependencies` maps of the consuming `package.json`, serialized as-is (`internal/vite-config/src/config/application.ts:87-96`, `internal/vite-config/src/utils/package-json.ts:43-54`). `appInfo: false` turns it off.

::: warning Nothing reads it Grepping `APP_INFO` across the repo yields two hits: the injection site and the comment at `apps/web/vite.config.ts:10`. No application code consumes it, so the "about page shows version and build time" promised by `utils/package-json.ts:42` is not wired up. Today the bundle simply carries a free dependency inventory. :::

### The channel that is not wired: CDN externals

`vite-plugin-cdn-import` is declared at `apps/web/package.json:162` but never imported — zero hits in `internal/vite-config` and in the application. So "external modules via CDN plus `rollupOptions.external`" **does not exist** in this repository; the `base: './'` output is a self-contained static directory, see [Build and deployment](/en/guide/essentials/deploy).

## 3. On-demand import, global registration and type declarations are three layers

These are routinely treated as one mechanism. They differ in when they act and what they cover:

| Layer | Mechanism | When it acts | Whom it covers | Source |
| --- | --- | --- | --- | --- |
| Compile time | writing `import { Card as ACard } from 'antdv-next'` | the SFC compiler wires that local binding into the template | `<ACard>` / `<a-card>` written **in this repository's source** | the header of 100+ `.vue` files in the app |
| Runtime | `app.component('a-xxx', Comp)` | at application start | **pre-compiled third-party templates** only | `apps/web/src/plugins/vendor-antd-components.ts:59-118` |
| Types | `components.d.ts` / `auto-imports.d.ts` | Rewritten by the plugins during dev/build | TypeScript and the IDE only; proves nothing about usage | `auto-import.ts:50`, `:53` |

### Compile time: there is no resolver any more, components come from imports

`createAutoImportPlugins()` (`internal/vite-config/src/plugins/auto-import.ts:41-64`) used to register three resolvers: `AntdvNextResolver` (`a-*` → `antdv-next`), `AntdvUiResolver` (the sub-package components) and `IconifyResolver` (bare `<Icon>`). **All three are gone** (the comment at `:12-25` of the same file explains why):

- A bare tag has nobody to inject it at compile time, so the runtime leaves a single `Failed to resolve component` warning while the page renders an empty element — icons vanishing silently, the designer shell collapsing into empty tags; every such incident had to be traced back through the build configuration.
- Explicit imports make "what is used, and from where" visible in the file header, and subpath writes such as `import { cn } from '@antdv/shared/utils/cn'` finally match how components are imported.
- The sub-packages no longer assume the host ships an auto-import setup: another application can just install `@antdv/common-ui` or `@antdv/icons` and run.

The `Components` plugin itself stays (`:52-54`) but only with its built-in behaviour: scanning the app's own `src/components` directory for local registration, with no npm package involved. On the `AutoImport` side (`:48-51`) the auto-imported surface is framework APIs only: `vue`, `@vueuse/core`, `pinia`, `VueRouterAutoImports` — the four functional entry points from `antdv-next` (`message`, `notification`, `Modal`, `Drawer`) were removed from it too and must now be imported by hand.

One detail that bites: when `<script setup>` compiles a template it looks for a local binding named `capitalize(camelize(tag))`, so `<a-card>` needs the alias `ACard` and `<Card>` needs `Card`. With the resolvers gone, the app-wide convention is `import { Card as ACard } from 'antdv-next'` plus a kebab-case tag, which lines up exactly with ESLint's `vue/component-name-in-template-casing`.

### Runtime: 36 components plus 1 placeholder

`apps/web/src/plugins/vendor-antd-components.ts` imports 36 named components from `antdv-next` (`:5-42`); `VENDOR_COMPONENTS` holds exactly 36 kebab-case keys (`:59-96`), and `registerVendorAntdComponents()` (`:112`) adds one more, `a-form-item-rest` (`:116`) — **37 `app.component` calls in total**. The entry point imports it at `apps/web/src/main.ts:32` and calls it at `:53`, before `app.use(pinia)`.

Why exactly these 36: `@form-create/antd-designer` ships templates that were **already compiled** when published; it looks components up at runtime via `resolveComponent('a-layout-sider')`, and the explicit imports in our source cannot help it (header comment `:44-58`). The list came from statically scanning that package.

::: warning Do not "simplify" this into `app.use(antd)` Full registration throws away tree-shaking and puts the whole component library into the bundle — exactly what the `vendor-ui` rule (`optimize.ts:9`) exists to avoid. The registration names must also stay kebab-case: per `:113-114`, the PascalCase path only works when the SFC compiler resolves tags, never at runtime. :::

`a-form-item-rest` is a React-antd concept (strip non-`Form.Item` props from the DOM); the Vue library has no such component and antdv-next does not provide it, yet the designer template hard-codes it — so a pass-through component that renders the default slot stands in (`:98-110`). Which means "37 registered" ≠ "37 used": `a-directory-tree` is in the table (`:64`) while `grep -rn "<a-directory-tree" apps/web/src` finds nothing — it serves the designer, not the app.

### Types: `components.d.ts` is a scan artifact, and entry counts mean nothing

Line 6 of `apps/web/types/components.d.ts` reads `Generated by unplugin-vue-components`; line 2 is `@ts-nocheck`. It is a **list of tags the scanner saw**, and the two implications must be kept apart:

- It should contain **no `antdv-next` entries any more**: after the resolvers were deleted the plugin no longer knows any third-party tag, only the app's own local components. If you see `typeof import('antdv-next')[...]` you are looking at a dev server that has not been restarted (the old configuration is still in memory).
- No entry does not mean unusable. With `VITE_WRITE_DTS=false` the plugins skip both files (`auto-import.ts:31-36`) and they stay at their previous state — and the 37 globally registered components never depended on this file anyway, since runtime registration goes through Vue's `GlobalComponents` interface.

Both files are committed (`git ls-files` shows them) and churn on every build, so do not read their diff as a semantic change. To know whether a given `a-*` is really used, there is exactly one route: search for the tag in `apps/web/src`.

## 4. Handing `packages/*` to another project

### Subpaths are modules

`@antdv/shared` combines a wildcard with explicitly listed directory modules (`packages/core/base/shared/package.json:21-43`; the reason sits in the `//exports` comment at `:20`):

| Import | Resolves to | Uses in this repo |
| --- | --- | --- |
| `@antdv/shared/utils/cn` | `dist/cn.js` (via `"./*"`, `:38-41`) | 107 |
| `@antdv/shared/cache` | `dist/cache/index.js` (listed, `:26-29`) | 13 |
| `@antdv/shared/utils/env` | `dist/env.js` | 5 |
| `@antdv/composables/websocket` | `dist/websocket/index.js` (listed, `packages/core/hooks/package.json:34-37`) | 2 (`apps/web/src/utils/ws.ts:3`) |

Build side: `packages/core/base/shared/tsdown.config.ts:13-20` declares `entry: ['src/index.ts', 'src/*.ts', 'src/*/index.ts']` with `platform: 'neutral'`, and `files: ["dist"]` (`packages/core/base/shared/package.json:14-16`) is what decides that only `dist` travels.

Why many entries instead of one barrel: importing only `cn` should not pull the initialization of `xlsx` / `dompurify` into the graph (`tsdown.config.ts:6-8`). `@antdv/composables` follows the same rule — `echarts / sse / websocket` stay on separate entries (`packages/core/hooks/src/index.ts:4-9`). Of those, the `./echarts` entry is declared in `exports` (`package.json:26-29`) and recommended in that comment, yet **no application code imports it**: a declared subpath is not a consumed subpath.

### Two publication shapes; the deciding question is whether it survives without Vite

| Shape | Packages | `main` | After editing `src` | Reusable outside |
| --- | --- | --- | --- | --- |
| dist-published | `shared`, `composables`, `directives`, `layouts`, `preferences`, `router`, `types` | `./dist/index.js` (`types` uses `./dist/index.mjs`) | Rebuild required | Yes, once `dist` exists |
| source-published | `@antdv/icons`, `@antdv/design` (`./src/index.css`) and the ten `@antdv/ui-kit` packages (`common-ui` / `shadcn-ui` / `form-ui` / `table-ui` / `popup-ui` / `layout-ui` / `menu-ui` / `tabs-ui` / `loading-ui` / `scrollbar-ui`; e.g. `packages/core/ui-kit/common-ui/src/components/scrollbar/package.json:12-19`: `files: ["src"]` with `main/types` both pointing at `./src/index.ts`) | Points at `src` | Hot-updates immediately | **No**: no build script; its `.vue` files and Tailwind entry are compiled by the consuming app's pipeline |

### Package boundaries are the only reason these are reusable

`packages/*` may not import `pinia`, a router instance, an application store, or read `import.meta.env`; when such a capability is needed, the application **injects** it (guard factories, directive factories, preference defaults). Details and injection examples live in [Core concepts](/en/guide/essentials/concepts) and [Directory structure](/en/guide/project/dir); from the bundle's point of view one sentence is enough: **a package bound to a store cannot be installed anywhere else**, no matter how clean its `exports` are. The one accepted exception — `packages/utils/src/menu.ts` importing only `vue-router` _types_ — never reaches the output and does not break the boundary.

### Versions move in lockstep — but today nothing can actually be published

`fixed: [["@antdv/*", "@antdv/*"]]` (`.changeset/config.json:10`) makes every `@antdv/*` package jump to the same version whenever any one of them bumps, and `privatePackages: { version: true, tag: true }` (`:14-17`) lets private packages join that bump and tagging. **For a consumer this means you receive a set of versions that move together; pinning one of them alone is not a thing** (the flip side of `workspace:*` for internal references — see [Changeset](/en/guide/project/changeset)).

::: warning There is no npm route right now `packages/*`, `internal/*`, `apps/*`, `docs` and `scripts/*` are **all** `"private": true` (checked file by file, e.g. `packages/core/base/shared/package.json:5`). `changeset publish` skips private packages, and `pnpm publint` (`vsh publint`) bails out at `scripts/vsh/src/publint/index.ts:166-168` with `if (pkgJson.private) return null;` — so this packaging check currently covers 0 packages. Practically, "give a package to another project" today means carrying the package directory (with its `dist`) out, or making it non-private first; `exports` and `files` are what makes either route work. :::

Editing `packages/*/src` does not show up in the application until a rebuild happens, because the app reads `dist` (and `turbo.json:16-24` orders builds with `dependsOn: ["^build"]`) — commands in [Quick start](/en/guide/introduction/quick-start).

### The library-mode build chain is ready, but has no consumer

`internal/vite-config/src/config/library.ts:39` exports `defineLibraryConfig()`, whose external list is `dependencies + peerDependencies` fully excluded (`internal/vite-config/src/utils/package-json.ts:62-70`; the comment at `:56-61` explains that bundling them would drag a second vue / antdv-next along). The packages that compile SFCs — `@antdv/icons` and the ten `@antdv/ui-kit` packages — **do not use it**; they have no build script at all, and only the tsdown-based packages emit `dist`. That is the wiring point for publishing a real component library.

## 5. The other direction: external sub-apps and the upstream repository

### The micro-frontend registry

`apps/web/src/config/micro-app.ts:5-92` is a registry of six sub-apps (`name` / `url` / `baseroute` / `icon` / `loader` …). Its `enabled` flag goes through `isEnvEnabled(import.meta.env.VITE_MICRO_APP)` (`:7`) — writing `=== true` there is permanently false, because `import.meta.env` values are strings. The contract lives in `packages/core/base/typings/src/micro-app.ts`, where `loader` accepts only `'iframe' | 'webcomponent'` (`:21`). How routes match a `baseroute` is covered by [Routes and menu](/en/guide/essentials/route).

The `<micro-app>` tag is not treated as an unregistered component: the compiler is told to consider it a native custom element (`internal/vite-config/src/plugins/custom-elements.ts:21-24`, wired at `internal/vite-config/src/plugins/vue.ts:38-46`). Only the explicitly registered `micro-app` tag and the `micro-` prefix qualify, and a name must contain a hyphen (`custom-elements.ts:47-55`) — otherwise a genuine registration failure would be silently rendered as an empty tag.

::: warning No micro-frontend SDK is installed `@micro-zoe/micro-app`, `wujie` and `qiankun` appear in zero `package.json` files. `<micro-app>` is a tag an SDK would define at runtime via `customElements.define()`; `SubAppView.vue:67` checks `!!window.microApp` for readiness and `:70` computes `useIframe = isExternalUrl || !isMicroAppReady`. With the current dependency set that expression is **always true**, so every path renders `<iframe>` (`:268-279`) and the `<micro-app>` branch (`:282-301`) is only there for a future SDK. The iframe `sandbox` omits `allow-same-origin` by default and opens it only for registry entries that declare `sameOrigin` (`:81-84`), and an enabled override shows a "same-origin preview" tag in the corner (`:312-318`). :::

### Upstream synchronization

`sync-upstream.json` names the upstream as `vbenjs/vue-vben-admin`, restricts `syncDirs` to `internal/lint-configs`, and keeps `previewMode: true`; `.sync-state.json` records the upstream OID of each synced file.

::: warning `pnpm sync-upstream` is broken The root `package.json` entry is `"sync-upstream": " sync-upstream"` — it only names a command of the same spelling. That command is neither in `node_modules/.bin` nor in `pnpm-lock.yaml` (both greps return nothing), so it cannot run as written. Do not expect it to pull upstream code. :::

## 6. External modules nobody uses anymore

This section is an inventory only — nothing is changed. Criteria: the package name is searched as a string in `apps/web/src`, `packages/**`, `internal/**` and `apps/backend-mock` (`*.ts` / `*.vue` / `*.mts`, `dist` excluded). Zero hits means "no direct import".

| Dependency | Declared at (`apps/web/package.json`) | Status |
| --- | --- | --- |
| `@videojs-player/vue`, `@videojs/http-streaming`, `video.js` | `:58`, `:59`, `:101` | **Newly orphaned by the video demo removal.** `git show HEAD:apps/web/src/views/components/video/index.vue` still imports all three (`:5`, `:9`, `:11`), and the three files under `views/components/video/` are deleted in the current working tree |
| `@vue-flow/background`, `/controls`, `/core`, `/minimap` | `:60-63` | Appear only in `apps/web/package.json`; deletion history shows no flow page ever existed |
| `bpmn-js`, `bpmn-js-i18n-zh`, `bpmn-js-properties-panel`, `camunda-bpmn-moddle` | `:71-74` | Same — zero hits |
| `@vue-office/docx`, `/excel`, `/pdf`, `/pptx` | `:64-67` | `docx`/`excel` survive only as comments and "loading preview…" placeholder copy in `views/components/upload/index.vue:1025-1064`; `pdf`/`pptx` lack even that. The `vendor-office` rule at `optimize.ts:24` is still in place |
| `codemirror`, `vue-codemirror`, `@codemirror/commands`, `/lang-javascript`, `/lang-sql`, `/lang-vue`, `/theme-one-dark` | `:29-33`, `:76`, `:104` | Zero hits |
| `@tiptap/core`, `/extension-document`, `/extension-highlight`, `/extension-link`, `/extension-list`, `/extension-underline`, `/markdown`, `/pm` | 16 declared, 7 imported | Imported: `@tiptap/{extension-image,extension-table,extension-text-align,extension-text-style,extensions,starter-kit,vue-3}`; the ones listed have no direct import (a few are peers of `starter-kit` / `extensions`) |
| `nanoid`, `qrcode`, `resize-observer-polyfill`, `vue-demi`, `vue-virtual-scroller` | `:90`, `:94`, `:95`, `:106`, `:111` | Zero hits |
| `vite-plugin-cdn-import`, `@vitejs/plugin-legacy`, `vite-plugin-iconify-offline` | `:139`, `:162`, `:167` | Build plugins in devDependencies with no import anywhere (same batch flagged at the end of [Configuration](/en/guide/essentials/config)) |

### How the tooling catches them

| Command | Actually runs | Details that matter |
| --- | --- | --- |
| `pnpm check:dep` | `vsh check-dep` → knip (pinned `knip: ^6.40.0` at `pnpm-workspace.yaml:266`) | Its config never lands on disk: it is inlined in `scripts/vsh/src/check-dep/index.ts:14-31`, written to `os.tmpdir()` and passed with `--include dependencies --reporter json` (`:92-98`, `:100-109`) — so it looks at **unused `dependencies`** only; unused devDependencies are outside what this command reports |
| `pnpm publint` | `vsh publint` → publint | Walks every workspace `package.json` (`scripts/vsh/src/publint/index.ts:39-52`) then returns early on private packages (`:166-168`) — with everything private in this repo, it reports nothing |
| `pnpm check:circular` | `vsh check-circular` | Cycles between packages; a different question from "unused" |
| `pnpm check` | circular + dep + type + cspell | The last link always fails (`cspell` is not a dependency of any package), see [FAQ](/en/guide/other/faq) |

::: warning "Reported unused" is not "safe to remove" The inlined knip config carries an `ignoreDependencies` list (`scripts/vsh/src/check-dep/index.ts:17-29`: `playwright`, `rimraf`, `tailwindcss`, plus the in-repo config packages `@antdv/{commitlint,eslint,oxfmt,oxlint,stylelint}-config` and `@antdv/{design,vite-config}`, which are only referenced at build time), `ignore` excludes `dist/**` and `docs/**` (`:15`), and `ignoreWorkspaces` drops `internal/lint-configs/*` and `scripts/*` (`:30`). Conversely, a dependency pulled in only as someone else's peer (the tiptap rows above) is never visible as a first-party import. Every row therefore has to be settled by asking "who imports it, and whose peer needs it". The upgrade-side equivalent of this warning is in [Updating the project](/en/guide/other/project-update). :::

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
