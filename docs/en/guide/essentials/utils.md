# Utilities

One criterion decides where a utility lives: **would it still work in another project**. If yes → `packages/`. If it needs a store, a router instance, or types from inside the app → it stays as a thin shell in `apps/web/src/`. Searching follows the same order: look in `@antdv/shared` first, then in `@antdv/hooks` / `@antdv/request`, and only then add something new under the app.

## What each of the three layers holds

| Layer | Location | Contents | Why it sits at this layer |
| --- | --- | --- | --- |
| Pure utilities | `packages/core/base/shared/src/**`, `packages/utils/src/**`, `packages/enums/src/**` | Caching, crypto, colour conversion, dates, download, Excel, masking, XSS, event bus; menu-tree and theme-mode resolution; cache keys and dictionary enums | No framework state: pure functions or self-contained singletons |
| Composables | `packages/core/hooks/src/**`, `packages/request/src/**` | Chunked upload, file reading, print, watermark, route loading, ECharts, permission checks, CRUD skeleton, reactive cache; HTTP / SSE / WebSocket | Uses Vue reactivity only; application capabilities arrive as parameters |
| App shells | `apps/web/src/utils/**`, `apps/web/src/composables/**`, `apps/web/src/components/common/**` | Wiring that needs a store / api / app-internal types | E.g. `utils/ws.ts:6` (assembles `eventBus`), `utils/securityInit.ts:9` (starts CSRF), `composables/useLocale.ts:4` (writes the locale into preferences) |

::: tip

Auto-import does not cover this repository's packages `internal/vite-config/src/plugins/auto-import.ts` only injects framework APIs. A line such as `import { cn } from '@antdv/shared/utils/cn'` has to be written by hand (see [Core concepts](/en/guide/essentials/concepts)).
:::

## Every subpath is a module

`packages/core/base/shared/package.json:21-55` declares `exports` with a `"./*"` wildcard (`:50-53`; `*` may contain slashes, so two-segment paths like `utils/cn` hit it too), and `packages/core/base/shared/tsdown.config.ts:16-22` sets `entry: ['src/index.ts', 'src/*.ts', 'src/*/*.ts', 'src/*/index.ts', 'src/*/*/index.ts']`: **each module file under `src/` is its own entry**, so `@antdv/shared/utils/cn` → `dist/utils/cn.js`. Multi-file directory modules (`cache` / `color` / `constants` / `utils`, plus `utils/crypto` / `utils/event` inside them) emit `dist/<dir>/index.js`, and the wildcard does not append `index` for them, so each is listed explicitly (`package.json:26-49`, with the note at `:20` in the same file). `platform: 'neutral'` (`tsdown.config.ts:24`): the output is consumed by a browser bundler, but the build itself runs rolldown on Node, and `platform: 'browser'` would let some polyfill heuristics intervene.

`@antdv/hooks` is the second instance of the same mechanism (`packages/core/hooks/package.json:21-35`, wildcard at `:30-33`); the only directory listed explicitly is `echarts` (`:26-29`): it drags in the full registry of the chart library, and putting it in the root entry would make `import { usePrint }` pay for parsing a chart library too (the comment at `:20` in the same file, plus `src/index.ts:7-11`). File names are always kebab-case — the subpath is `@antdv/hooks/use-print`, the same vocabulary `@antdv/layouts` uses for its hooks directory.

`@antdv/request` / `@antdv/utils` / `@antdv/enums` publish no dist at all: their `exports` point straight at `.ts` source files, so their "subpaths" are just the shape of the source directories — `packages/request/package.json:19-25` (`./runtime`, `./sse`, `./websocket`), `packages/utils/package.json:19-24` (`./menu`, `./theme-mode`), `packages/enums/package.json:18-21` (root entry only).

```ts
import { cn } from '@antdv/shared/utils/cn'; // single-file module → subpath
import { cache } from '@antdv/shared/cache'; // directory module, listed explicitly
import { cache } from '@antdv/shared'; // the root barrel works too (src/index.ts:12-16)
import { usePrint } from '@antdv/hooks/use-print'; // kebab-case file name
import { useEcharts } from '@antdv/hooks/echarts';
import { useWebSocket } from '@antdv/request/websocket';
import { menuKeyOf } from '@antdv/utils/menu';
```

::: warning

The wildcard entry belongs only to the dist-published packages. Only `@antdv/shared` and `@antdv/hooks` have `"./*"`. Adding a wildcard to a source-published package widens the resolution path for `import type` as well, and then type-checking and the bundler are no longer looking at the same table.
:::

## `@antdv/shared` inventory

"Tested" means a matching spec file exists in `packages/core/base/shared/__tests__/`. The consumer column gives one real call site, not the full list.

| Module (subpath) | Representative exports | Consumers | Tested |
| --- | --- | --- | --- |
| `cache` | `cache` (`src/cache/index.ts:197`), `createCache` (`:60`), `buildStorageKey` (`:40`), `encryptToken` / `decryptToken` (`src/cache/tokenCrypto.ts:77,106`) | `packages/stores/src/user.ts:7`, `apps/web/src/plugins/request-runtime.ts:3`, `packages/core/preferences/src/preferences.ts:11` (14 files) | yes |
| `color` | `parseColor` (`src/color/convert.ts:32`), `toRgbString` / `toHex` (`:41,46`), `mixWithWhite` (`:55`) | `packages/layouts/src/widgets/setting-drawer/components/appearance-panel.vue:21`, `layout-panel.vue` | yes |
| `constants` | `PREFERENCE_CSS_VARS` (`src/constants/css-vars.ts:37`), `DARK_CLASS` / `COLOR_WEAK_CLASS` / `GRAY_MODE_CLASS` (`src/constants/dom-classes.ts:10,12,14`), `DEFAULT_PRIMARY_COLOR` and `BORDER_RADIUS_BASE` (`src/constants/theme.ts:9,13`), `THEME_PRESETS` / `themeKeyByColor` (`src/constants/theme-presets.ts:26,59`) | `packages/core/preferences/src/update-css-variables.ts` (the writer), `packages/core/preferences/src/config.ts`, `apps/web/src/settings/theme/index.ts` (13 files) | yes |
| `utils/cn` | `cn()` (`src/utils/cn.ts:6`) | 459 files repo-wide, e.g. `packages/layouts/src/widgets/breadcrumb.vue` | yes |
| `utils/crypto` | `encrypt` / `decrypt` / `encryptObject` / `decryptObject` (`src/utils/crypto/aes.ts:14,19,24,31`), `md5` / `md5File` / `sha256` / `hash` (`src/utils/crypto/hash.ts:3,7,32,40`) | **no call sites** | no |
| `utils/csrf` | `config` (`src/utils/csrf.ts:67`), `initCsrfProtection` (`:111`), `getCsrfToken` (`:164`) | `packages/request/src/fetcher.ts:8`, `apps/web/src/utils/securityInit.ts:9` | yes |
| `utils/dayjs` | `dayjs` (`src/utils/dayjs.ts:136`), `setTimezone` (`:62`), `nowTz` (`:116`) | `packages/stores/src/app.ts:8`, `packages/layouts/src/widgets/timezone/index.vue:12`, `apps/web/src/composables/useLocale.ts:4` (8 files) | yes |
| `utils/domUtils` | `getBoundingClientRect` (`src/utils/domUtils.ts:14`), `getViewportOffset` (`:89`), `useRafThrottle` (`:187`) | **no call sites** | yes |
| `utils/download` | `saveBlob` (`src/utils/download.ts:159`), `downloadFile` (`:248`), `downloadWithAuth` (`:416`), `downloadMultiple` (`:552`) | **no call sites** (downloads go through `@antdv/request`'s response handling) | no |
| `utils/env` | `configureSharedEnv` (`src/utils/env.ts:32`), `isEnvEnabled` (`:88`), `getCachePrefix` (`:74`) | `apps/web/src/bootstrap/env.ts:1`, `apps/web/src/mock/activate.ts`, `apps/web/src/config/micro-app.ts` (8 files) | yes |
| `utils/event` | `eventBus` / `createEventBus` (`src/utils/event/bus.ts:45,5`), `addResizeListener` (`src/utils/event/resize.ts:71`), `useResizeListener` (`:151`) | `apps/web/src/utils/ws.ts:6`, `packages/layouts/src/basic/layout.vue:11` (root barrel) | yes |
| `utils/excel` | `exportToExcel` (`src/utils/excel.ts:42`) | `apps/web/src/utils/excel.ts:4` (a shell that adds a toast) | no |
| `utils/file-category` | `getExt` (`src/utils/file-category.ts:15`), `getFileCategory` (`:98`) | **no call sites** | yes |
| `utils/iframe` | `buildIframeSandbox` (`src/utils/iframe.ts:95`), `canEscapeSandbox` (`:129`), `SANDBOX_FLAGS` (`:23`) | `apps/web/src/views/micro-app/SubAppView.vue:13`, `apps/web/src/views/system/micro-app/index.vue` | yes |
| `utils/jwt` | `isTokenExpired` (`src/utils/jwt.ts:97`); `parseJwt` (`:70`), `isJwtFormat` (`:138`), `getTokenRemainingSeconds` (`:121`) | `packages/request/src/fetcher.ts:9` (only `isTokenExpired`) | yes |
| `utils/masking` | `maskPhone` / `maskEmail` / `maskIdCard` (`src/utils/masking.ts:22,30,40`), `MASKING_RULES` (`:84`) | **no call sites** | yes |
| `utils/scroll` | `computeOverflow` (`src/utils/scroll.ts:28`), `useHorizontalScroll` (`:72`), `pickHorizontalDelta` (`:47`) | `packages/core/ui-kit/menu-ui/src/BasicMenu.vue:10`, `tabs-ui/src/TabsBar.vue:17` | yes |
| `utils/template` | `generateTemplate` (`src/utils/template.ts:30`) | `apps/web/src/components/business/ImportExport.vue:11` | yes |
| `utils/xss` | `safeHtmlDirective` (`src/utils/xss.ts:446`), `escapeDirective` (`:463`), `escapeHtml` (`:179`) | `apps/web/src/directives/index.ts:17` → `main.ts:122,126`; `packages/core/hooks/src/use-print.ts:2`; `packages/core/ui-kit/common-ui/src/components/markdown-editor/MarkdownEditor.vue:24` | yes |
| `store` | `src/store.ts:12` forwards `@tanstack/vue-store` wholesale | none yet: shared state is supposed to come from here instead of per-feature ref singletons | covered by `__tests__/structure.test.ts` |

::: warning

Two things have already moved out of shared. The menu tree and key system (`menuKeyOf`, `attachMenuPaths`, `MenuPathRouter`) now live in `packages/utils/src/menu.ts:28,258,393`, and `theme-mode.ts` in the same package handles theme-mode resolution and system-dark detection — because `@antdv/shared` is not allowed to depend on a menu vocabulary beyond `@antdv/types`, while `@antdv/utils` consumes only those two packages. `utils/welcome.ts` (the login welcome toast) no longer exists as a file at all; do not go looking for it by name.
:::

## `@antdv/hooks` inventory

This layer is actually better tested than `shared` — all eight hooks plus `echarts` have a matching spec in `packages/core/hooks/__tests__/`, and there is an extra `boundary.test.ts` guarding the package boundary.

| Export | Entry | Consumers | Tested |
| --- | --- | --- | --- |
| `useChunkUpload` | `@antdv/hooks/use-chunk-upload` (`src/use-chunk-upload.ts:76`) | `apps/web/src/views/components/upload/index.vue` | yes |
| `useFileReader` | `.../use-file-reader` (`src/use-file-reader.ts:3`) | `apps/web/src/components/common/AvatarUploader.vue` | yes |
| `usePrint` | `.../use-print` (`src/use-print.ts:47`) | `apps/web/src/views/system/user/index.vue` and two more pages | yes |
| `useRouteLoading` | `.../use-route-loading` (`src/use-route-loading.ts:24`) | `packages/layouts/src/basic/layout.vue` | yes |
| `useWatermark` | `.../use-watermark` (`src/use-watermark.ts:48`) | `packages/layouts/src/basic/layout.vue` | yes |
| `useCache` | `.../use-cache` (`src/use-cache.ts:41`) | **no call site in the app** (only its own spec) | yes |
| `useCRUD` | `.../use-crud` (`src/use-crud.ts:134`) | `apps/web/src/views/components/table/crud/index.vue:34` | yes |
| `usePermission` | `.../use-permission` (`src/use-permission.ts:68`) | `apps/web/src/directives/index.ts:13`, `apps/web/src/plugins/table-runtime.ts:1` | yes |
| `useEcharts` / `setupEcharts` / `theme` / `constants` | `@antdv/hooks/echarts` (`src/echarts/use-echarts.ts:91`, `setup.ts:39`) | **no call sites**: chart pages use `@antdv/common-ui/charts` (`packages/core/ui-kit/common-ui/src/components/charts/ECharts.vue`) | yes |

SSE and WebSocket are not here. Real-time code is collected in `@antdv/request` — `useSSE` and its three managers under `@antdv/request/sse`, `useWebSocket` and its four managers under `@antdv/request/websocket` — so it shares one reconnection semantics with HTTP (see `packages/core/hooks/src/index.ts:13-14`).

## The app-side shells

| File | Exports | Status |
| --- | --- | --- |
| `apps/web/src/utils/ws.ts:340` | `useWebSocket` (the shell), `WS_EVENTS` (`:75`), `noticeTypeConfig` (`:51`) | in use: the notification widget in `packages/layouts` reaches it through injection at `plugins/layouts-host.ts:9` |
| `apps/web/src/utils/securityInit.ts:16` | `initSecuritySystem` | in use (`main.ts:39,114`) |
| `apps/web/src/utils/excel.ts:10` | `exportToExcel` | in use: wires the return value of `@antdv/shared/utils/excel` to a `@antdv/popup-ui` toast |
| `apps/web/src/composables/index.ts:6` | `export * from '@antdv/request'` | the request layer is in use (`api/request.ts`, `api/query.ts`, …); `useCRUD` and `usePermission` have moved into `@antdv/hooks` and pages and directives import them from the package |
| `apps/web/src/composables/useLocale.ts` | `useLocale` / `useLocaleSync` / `localeLabels` | in use (`App.vue:9`, `plugins/layouts-host.ts:6`, `views/login/index.vue:34`) |
| `apps/web/src/composables/useNotice.ts` | `useNotice` | **no call sites** — the notification logic moved into `packages/layouts` with the widget and is host-injected |
| `apps/web/src/composables/usePasswordPolicy.ts` | `usePasswordPolicy` | **no call sites** |

`apps/web/src/utils/**` and the app-side shells have **no unit tests**: under `apps/web/src/` no utils specs remain in `__tests__` (once logic moved into a package it gained matching cases — the request layer in `packages/request/__tests__/`, the composables in `packages/core/hooks/__tests__/`). That is the division of labour showing up in the test layout: the logic belongs in a package, where it can be tested.

::: warning

Components inside a package must not import the app back. After widgets such as notifications and global search moved into `packages/layouts`, they can no longer `import '~/api'` or `'~/utils/ws'` directly (a package depending on the app is a cycle). Every "only the app knows this" capability is injected once from `apps/web/src/plugins/layouts-host.ts`: `:9` for the ws channel, `:6` for the locale candidates, `:5` for the notice api; `:17-19` explain why that file stands alone instead of being folded into `ui-runtime.ts` (`test/setup.ts` calls the latter, setup runs before the `vi.mock` in a case, and a module touched once cannot be mocked afterwards).
:::

## The hard boundary: no pinia, no app alias, no env inside packages

These three rules are not style preferences — `packages/request/__tests__/structure.spec.ts:40-52` enforces them with file-level assertions: under `src`, anything other than `index.ts` that contains `from 'pinia'`, `from '~/...'`, `import.meta.env.` or `antdv-next` fails the suite (the same spec pins the file list at `:26-37` and the export list at `:54-79`).

| Rule | Fact | Exception |
| --- | --- | --- |
| No `import ... from 'pinia'` | Across all of `packages/**/src` only `packages/stores/src/{app,route,tabs,user}.ts` hit — that package's job is holding stores | `@antdv/stores` only |
| No `~/` alias | One hit left in `packages/**/src`: the example inside the doc comment at `packages/core/hooks/src/use-chunk-upload.ts:32` | none |
| No reading `import.meta.env` | Every hit in package source is **inside a comment** (`packages/core/base/shared/src/cache/index.ts:29-30`, `packages/core/base/shared/src/utils/env.ts:4-8`, `packages/core/preferences/src/config.ts:10-12`, `packages/core/ui-kit/common-ui/src/components/error-boundary/ErrorBoundary.vue:31`); env is injected by the app entry | none |
| Avoid `vue-router` at runtime | The runtime imports are concentrated in two places: `packages/core/hooks/src/use-route-loading.ts:2` and `packages/layouts/src/**` (a layout genuinely needs the router). Other packages take types only, e.g. `import type { RouteRecordRaw }` at `packages/utils/src/menu.ts:3` | layouts plus that one hook |

## Dependency injection is how a package gets app capabilities

| Capability needed | What the package accepts | Where the app injects it |
| --- | --- | --- |
| Storage / prefix / key | `createPreferences({ cache, cacheKey, matchMedia })` (`packages/core/preferences/src/preferences.ts:27-35`) | The default instance's storage comes from `configureSharedEnv` injection (`apps/web/src/bootstrap/env.ts`) |
| Environment info | `configureSharedEnv({ cachePrefix, cacheEncryptKey, minioPublicUrl, production })` (`packages/core/base/shared/src/utils/env.ts:32-42`) | `apps/web/src/bootstrap/env.ts:1-7` |
| Credentials, login route, logout cleanup | `configureRequest(runtime)` (`packages/request/src/runtime.ts:43`, type at `:20`) | `apps/web/src/plugins/request-runtime.ts:2,15` |
| Permission checks | `createPermissionDirective({ checkers, onCheck, subscribe })` (`packages/directives/src/permission/index.ts:54`) | `apps/web/src/directives/index.ts:19` |
| Chunk processing | `useChunkUpload({ createWorker, workerUrl })` (`packages/core/hooks/src/use-chunk-upload.ts:35-38`) | The app supplies `apps/web/src/components/common/Upload/upload.worker.ts` |
| Widget api / push / pages | `configureLayoutHost({ ... })` (`packages/layouts`) | `apps/web/src/plugins/layouts-host.ts:24` |

`MemoryCache` in `packages/core/base/shared/src/cache/memory.ts` is the counter-example of that boundary: it genuinely does get built (the `src/*/*.ts` pattern in `tsdown.config.ts` covers it, `dist/cache/memory.js` exists, and the `"./*"` wildcard lets `@antdv/shared/cache/memory` resolve), but `cache/index.ts` does not re-export it and there are **zero call sites** repo-wide — dead code. Do not assume you are a consumer because the name looks sensible; for a memory-backed store use `createStorage('memory')` (`src/cache/storage.ts:56,72`).

## `cn()` is the only way class names get concatenated

```ts
// packages/core/base/shared/src/utils/cn.ts:1-8
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

`from '@antdv/shared/utils/cn'` appears in **459 files**: 62 under `apps/web`, 397 under `packages` — of which 314 are the shadcn-generated atoms in `ui-kit/shadcn-ui`, followed by `common-ui` 36, `form-ui` 13, `layouts` 12, `table-ui` 7, `tabs-ui` 4, `popup-ui` 4, `menu-ui` 3, `layout-ui` 2, and one each in `icons` and `hooks`. The repository contains no second `cn` implementation and no other class-merge library. `@antdv/shared` therefore depends on `clsx` + `tailwind-merge` (`packages/core/base/shared/package.json:62,70`); `apps/web` also lists both directly (`apps/web/package.json:72,97`), but **do not** reach for `import { twMerge }` in app code — conflict resolution only becomes a convention while one implementation exists.

Naming follows `CODE_STANDARD.md` section 2: Tailwind first, `cn()` for anything dynamic or complex.

## Does changing `packages/*/src` require a rebuild?

It depends on whether the package publishes dist or source:

| Shape | Packages | After editing `src` |
| --- | --- | --- |
| Dist-published (6) | `@antdv/shared`, `@antdv/types`, `@antdv/hooks`, `@antdv/preferences`, `@antdv/directives`, `@antdv/router` | Must be rebuilt |
| Source-published (15) | `@antdv/utils`, `@antdv/request`, `@antdv/enums`, `@antdv/stores`, `@antdv/layouts`, `@antdv/design`, `@antdv/icons` and the 8 ui-kit packages | Saving is enough (`main` points at `./src/index.ts`, so they are already in Vite's module graph) |

```bash
pnpm --filter @antdv/shared build      # or @antdv/hooks / @antdv/preferences …
# then restart dev: `pnpm dev:web` runs vite only, it does not build sub-packages
```

`turbo` gives `dev` / `build` a `dependsOn: ["^build"]`, so `pnpm dev` (through `turbo-run`) and a full `build` produce upstream dists first. But `pnpm dev:web` (`package.json:25`) is `pnpm --filter @antdv/web run dev` — **vite only**. Each dist package's own `dev` script is `tsdown --watch` (`packages/core/base/shared/package.json:10`, `packages/core/hooks/package.json:10`); keep that running separately if you want edits to land as you save.

::: warning

The symptom is "nothing changed, and nothing failed". You edit `packages/core/base/shared/src/**`, save, and behaviour and types stay exactly as they were, with no error, because Vite's dependency cache and `optimizeDeps` both point at `dist`. Build first, restart second; do not copy the implementation into the app to work around it.
:::

## Related pages

- [Core concepts](/en/guide/essentials/concepts) — the full rationale for the layering and the two publish shapes
- [Composables](/en/guide/in-depth/composables) — the signature of every composable in hooks and request
- [Caching](/en/guide/essentials/cache) — how `cache` works and how keys are built
- [State management](/en/guide/essentials/stores) — what deserves persistence, and the logout cleanup exit
- [Configuration](/en/guide/essentials/config) — `VITE_*` and the `configureSharedEnv` injection chain
- [Local development](/en/guide/essentials/development) — dev server and package watch
- [Unit testing](/en/guide/project/testing) — running the specs inside a package
- [Third-party dependencies](/en/guide/essentials/external) — package inventory and dependency reconciliation
