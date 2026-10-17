# Utilities

One criterion decides where a utility lives: **would it still work in another project**. If yes → `packages/`. If it needs a store, a router instance, or types from inside the app → it stays as a thin shell in `apps/web/src/`. Searching follows the same order: look in `@antdv/shared` first, then `@antdv/composables`, and only then add something new under the app.

## What each of the three layers holds

| Layer | Location | Contents | Why it sits at this layer |
| --- | --- | --- | --- |
| Pure utilities | `packages/shared/src/**` | Caching, crypto, dates, download, Excel, masking, XSS, CSRF, event bus, menu helpers | No framework state: pure functions or self-contained singletons |
| Composables | `packages/composables/src/**` | Chunked upload, print, watermark, ECharts, SSE, WebSocket, reactive cache, route loading, file reading | Uses Vue reactivity only, never pinia or a business store |
| App shells | `apps/web/src/utils/**`, `apps/web/src/composables/**` | Wiring that needs a store / api / app-internal types | E.g. `utils/dict.ts:2` (reads the dict store), `utils/ws.ts:8` (takes the token from the user store), `utils/routePreload.ts:19,66` (`useRouter`) |

::: tip Auto-import does not cover this repository's packages `internal/vite-config/src/plugins/auto-import.ts` only injects framework APIs. A line such as `import { cn } from '@antdv/shared/utils/cn'` has to be written by hand (see [Core concepts](/en/guide/essentials/concepts)). :::

## Every subpath is a module

`packages/core/base/shared/package.json:21-55` declares `exports` with a `"./*"` wildcard (`*` may contain slashes, so two-segment paths like `utils/cn` hit it too), and `packages/core/base/shared/tsdown.config.ts:16-22` sets `entry: ['src/index.ts', 'src/*.ts', 'src/*/*.ts', 'src/*/index.ts', 'src/*/*/index.ts']`: **each module file under `src/` is its own entry**, so `@antdv/shared/utils/cn` → `dist/utils/cn.js`. Multi-file directory modules (`cache` / `color` / `constants` / `utils`, plus `utils/crypto` / `utils/event` inside them) emit `dist/<dir>/index.js`, and the wildcard does not append `index` for them, so each is listed explicitly (`package.json:26-49`, with the note at `:20` in the same file).

`@antdv/composables` works the same way; the directories listed explicitly are `echarts` / `sse` / `websocket` (`packages/composables/package.json:26-37`). Heavy dependencies (the full echarts registry, `watermark-plus`) stay on their own entries on purpose, so `import { usePrint }` does not pay for parsing a chart library (comment at `:20`, plus `src/index.ts:2-12`).

```ts
import { cn } from '@antdv/shared/utils/cn'; // single-file module → subpath
import { cache } from '@antdv/shared/cache'; // directory module, listed explicitly
import { cache } from '@antdv/shared'; // the root barrel works too (src/index.ts:11-15, explicit export *)
import { useWebSocket } from '@antdv/composables/websocket';
```

## `@antdv/shared` inventory

"Tested" means a matching spec file exists in `packages/shared/__tests__/`. The consumer column gives one real call site, not the full list.

| Module (subpath) | Representative exports | Consumers | Tested |
| --- | --- | --- | --- |
| `cache` | `cache` (`src/cache/index.ts:196`), `createCache` (`:60`), `buildStorageKey` (`:40`), `encryptToken` / `decryptToken` (`src/cache/tokenCrypto.ts:77,106`) | `stores/modules/user.ts:5` | yes |
| `cn` | `cn()` (`src/utils/cn.ts:6`) | 460 files repo-wide, e.g. `packages/ui-kit/layout-ui/src/components/LayoutBreadcrumb.vue:14` | yes |
| `color` | `parseColor` (`src/color/convert.ts:23`), `toRgbString` / `toHex` (`:45,50`), `mixWithWhite` (`:60`) | `layouts/components/SettingDrawer/components/AppearancePanel.vue:22`, `LayoutPanel.vue:32` | yes |
| `constants` | `PREFERENCE_CSS_VARS` (`src/constants/css-vars.ts:36`), `DARK_CLASS` / `COLOR_WEAK_CLASS` / `GRAY_MODE_CLASS` (`src/constants/dom-classes.ts:10,12,14`), `DEFAULT_PRIMARY_COLOR` / `BORDER_RADIUS_BASE` (`src/constants/theme.ts:9,13`), `THEME_PRESETS` / `themeKeyByColor` (`src/constants/theme-presets.ts:26,63`) | `packages/utils/src/css-vars.ts:3` (the writer), `packages/core/preferences/src/defaults.ts:3` | yes |
| `crypto` | `encrypt` / `decrypt` / `encryptObject` / `decryptObject` (`src/utils/crypto/aes.ts:14,19,24,31`), `md5` / `md5File` / `sha256` / `hash` (`src/utils/crypto/hash.ts:3,7,32,40`) | **no call sites** | no |
| `csrf` | `config` (`src/utils/csrf.ts:67`), `initCsrfProtection` (`:111`), `getCsrfToken` (`:164`) | `packages/request/src/fetcher.ts:4-8`, `utils/securityInit.ts:9` | yes |
| `dayjs` | `dayjs` (`src/utils/dayjs.ts:136`), `setTimezone` (`:62`), `nowTz` (`:116`) | `stores/modules/app.ts:7,130`, `layouts/widgets/WidgetTimezone.vue:8`, `composables/web/useLocale.ts:4` | yes |
| `domUtils` | `getBoundingClientRect` (`src/utils/domUtils.ts:14`), `getViewportOffset` (`:89`), `useRafThrottle` (`:187`) | **no call sites** | yes |
| `download` | `saveBlob` (`src/utils/download.ts:159`), `downloadFile` (`:248`), `downloadWithAuth` (`:416`), `downloadMultiple` (`:552`) | **no call sites** | no |
| `env` | `configureSharedEnv` (`src/utils/env.ts:32`), `isEnvEnabled` (`:86`), `getCachePrefix` (`:72`) | `bootstrap/env.ts:1`, `mock/activate.ts:1`, `config/micro-app.ts:3` | yes |
| `event` | `eventBus` / `createEventBus` (`src/utils/event/bus.ts:45,5`), `addResizeListener` (`src/utils/event/resize.ts:71`), `useResizeListener` (`:151`) | `utils/ws.ts:4,118`, `layouts/components/LayoutHeader.vue:8` | yes (the bus plus `triggerWindowResize`) |
| `excel` | `exportToExcel` (`src/utils/excel.ts:40`) | `views/system/role/index.vue:8` and four more list pages | no |
| `file-category` | `getExt` (`src/utils/file-category.ts:15`), `getFileCategory` (`:98`) | **no call sites** | yes |
| `iframe` | `buildIframeSandbox` (`src/utils/iframe.ts:95`), `canEscapeSandbox` (`:131`), `SANDBOX_FLAGS` (`:23`) | `views/micro-app/SubAppView.vue:8` | yes |
| `jwt` | `isTokenExpired` (`src/utils/jwt.ts:97`); `parseJwt` (`:70`), `isJwtFormat` (`:138`), `getTokenRemainingSeconds` (`:121`) | `packages/request/src/fetcher.ts:9,214` (only `isTokenExpired`) | yes |
| `masking` | `maskPhone` / `maskEmail` / `maskIdCard` (`src/utils/masking.ts:22,30,40`), `MASKING_RULES` (`:84`) | **no call sites** | yes |
| `menu` | `menuKeyOf` (`src/utils/menu.ts:32`), `attachMenuPaths` (`:258`), `buildMenuItems` (`:561`), `MenuPathRouter` (`:393`) | `stores/modules/route.ts:1-15`, `layouts/composables/useSidebarMenu.ts:10`, `packages/layouts/src/menu-source.ts:18` | yes |
| `scroll` | `computeOverflow` (`src/utils/scroll.ts:28`), `useHorizontalScroll` (`:72`), `pickHorizontalDelta` (`:47`) | `packages/core/ui-kit/menu-ui/src/BasicMenu.vue`, `tabs-ui/src/TabsBar.vue` | yes |
| `store` | `useStore` / `useAtom` / `useSelector` (`src/store.ts:12`, re-exporting `@tanstack/vue-store` wholesale) | none yet: shared state is supposed to come from here instead of per-feature ref singletons | covered by `__tests__/structure.test.ts` |
| `template` | `generateTemplate` (`src/utils/template.ts:30`) | `components/business/ImportExport.vue:7,194` | yes |
| `welcome` | `showLoginWelcome` (`src/utils/welcome.ts:114`), `getPersonalizedWelcome` (`:66`) | **no call sites** | yes |
| `xss` | `safeHtmlDirective` (`src/utils/xss.ts:437`), `escapeDirective` (`:454`), `escapeHtml` (`:173`) | `directives/index.ts:17` → `main.ts:103,107`; `escapeHtml` is used by `packages/core/composables/src/usePrint.ts:2` | yes |

## `@antdv/composables` inventory

This layer is actually better tested than `shared` — every entry has a spec in `packages/composables/__tests__/`.

| Export | Entry | Consumers | Tested |
| --- | --- | --- | --- |
| `useChunkUpload` | `@antdv/composables/useChunkUpload` (`src/useChunkUpload.ts:76`) | `views/components/upload/index.vue:7,356` | yes |
| `useFileReader` | `.../useFileReader` (`src/useFileReader.ts:3`) | `components/common/AvatarUploader.vue:6` | yes |
| `usePrint` | `.../usePrint` (`src/usePrint.ts:47`) | `views/system/user/index.vue:7,344` and two more pages | yes |
| `useRouteLoading` | `.../useRouteLoading` (`src/useRouteLoading.ts:24`) | `layouts/index.vue:8,164` | yes |
| `useWatermark` | `.../useWatermark` (`src/useWatermark.ts:48`) | `layouts/index.vue:9,169` | yes |
| `useCache` | `.../useCache` (`src/useCache.ts:41`) | **no call site in the app** (only its own spec) | yes |
| `useEcharts` / `setupEcharts` / `theme` / `constants` | `@antdv/composables/echarts` (`src/echarts/useEcharts.ts:91`, `setup.ts:39`) | **no call site**; pages still do `import * as echarts from 'echarts'` (`components/common/ECharts/index.vue:4`) | yes |
| `useSSE` + the three managers | `@antdv/composables/sse` (`src/sse/useSSE.ts:23`) | **no call site** (`apps/web/src/composables/web/sse/` is an empty directory) | yes |
| `useWebSocket` + `EventManager` / `HeartbeatManager` / `ReconnectManager` / `WebSocketStateManager` | `@antdv/composables/websocket` (`src/websocket/useWebSocket.ts:44`) | `apps/web/src/utils/ws.ts:3` (a shell that re-exports its own `useWebSocket`) | yes |

::: warning Those empty directories are "moved out", not "not written yet" `apps/web/src/composables/web/sse/` and `apps/web/src/composables/web/websocket/` are empty because the implementations live in `packages/composables` now. What stayed on the app side is the layer that needs a store (`utils/ws.ts` assembles notifications, emits on `eventBus`, reads the token). Check the package before adding a file in there. :::

## The app-side shells

| File | Exports | Status |
| --- | --- | --- |
| `apps/web/src/utils/dict.ts:7,18` | `getDictLabel` / `getDictLabels` | in use (`components/business/Description/Description.vue:19`) |
| `apps/web/src/utils/ws.ts:338` | `useWebSocket`, `WS_EVENTS` (`:76`), `noticeTypeConfig` (`:52`) | in use (`composables/useNotice.ts:11`, `layouts/widgets/WidgetNotice.vue:15`) |
| `apps/web/src/utils/securityInit.ts:16` | `initSecuritySystem` | in use (`main.ts:35,95`) |
| `apps/web/src/utils/crud-actions.ts:15` | `createCrudActions` | **no call site** |
| `apps/web/src/utils/routePreload.ts:38,110,130` | `preloadRoute` / `preloadRoutes` / `useRoutePreloader` | **no call site** (only re-exported by `utils/index.ts:3`) |
| `apps/web/src/composables/index.ts:1-3` | `useCRUD`, `usePermission`, everything from `@antdv/request` | The request layer is in use (`stores/modules/user.ts:7`, `route.ts:18` take `http`); `usePermission` is imported straight from `~/composables/web/permission` (`directives/index.ts:13`); `useCRUD` (`useCRUD.ts:100`) has **no call site** |
| `apps/web/src/composables/useNotice.ts:62` | `useNotice` | **no call site** |
| `apps/web/src/composables/usePasswordPolicy.ts:24` | `usePasswordPolicy` | **no call site** |

Neither `utils/**` nor `composables/useCRUD.ts` has unit tests: no `__tests__` directory exists under `apps/web/src/utils` (the request layer lives in its own package and does — `packages/request/__tests__/`). That is the division of labour showing up in the test layout: the logic should be in a package, where it can be tested.

## The hard boundary: no pinia, no stores, no env inside packages

These three rules are architectural borders, not style preferences, and checking them is cheap:

| Rule | Fact | Exception |
| --- | --- | --- |
| No `import ... from 'pinia'` | **zero hits** across `packages/*/src` | none |
| No app store imports, no `~/` alias | zero hits for `from '~/...'` in `packages/*/src` (only the example inside the doc comment at `useChunkUpload.ts:32`) | none |
| No reading `import.meta.env` | **no runtime read anywhere** in package sources (only comments mention it); env is injected by the app entry (`packages/shared/src/utils/env.ts:1-10`, `apps/web/src/bootstrap/env.ts:1-7`) | none |
| Avoid `vue-router` at runtime | exactly one runtime import in all package sources: `packages/composables/src/useRouteLoading.ts:2` (`useRouter`, which genuinely needs the router instance); everything else is types, e.g. `import type { RouteRecordRaw }` at `packages/shared/src/utils/menu.ts:4` | that one line |

When a package needs application state it receives it through dependency injection, which is what makes these packages reusable elsewhere and testable without the app:

| Capability needed | What the package accepts | Where the app injects it |
| --- | --- | --- |
| Storage / prefix / key | `createPreferences({ cache, cacheKey, expire })` (`packages/core/preferences/src/store.ts:26-31`) | The default instance follows `configureSharedEnv` (`apps/web/src/bootstrap/env.ts`) |
| Environment info | `configureSharedEnv({ cachePrefix, cacheEncryptKey, minioPublicUrl, production })` (`packages/shared/src/utils/env.ts:32-42`) | `apps/web/src/bootstrap/env.ts:2-7` |
| Permission checks | `createPermissionDirective({ checkers, onCheck, subscribe })` | `apps/web/src/directives/index.ts:19` |
| Chunk processing | `useChunkUpload({ createWorker, workerUrl })` (`packages/composables/src/useChunkUpload.ts:35-37`) | The app supplies `upload.worker` |

`MemoryCache` in `packages/shared/src/cache/memory.ts` is the counter-example of that boundary: it is not exported by `cache/index.ts` and it is not a tsdown entry (entries stop at `src/*/index.ts`), so **nothing outside the file can reach it**. It is dead code — do not assume it is importable because the name looks sensible.

## `cn()` is the only way class names get concatenated

```ts
// packages/shared/src/utils/cn.ts:1-8
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

`from '@antdv/shared/utils/cn'` appears in **460 files** (82 under `apps/web`, 378 under `packages` — of which 314 are the shadcn-generated atoms in `ui-kit/shadcn-ui`, followed by `common-ui` 28, `form-ui` 14, `table-ui` 7, `popup-ui` 4, `tabs-ui` 4, `menu-ui` 3, `layout-ui` 2, and one each in `icons` and `composables`), and the repository contains no second `cn` implementation and no other class-merge library. `@antdv/shared` therefore depends on `clsx` + `tailwind-merge` (`packages/core/base/shared/package.json:62,70`); `apps/web` also lists both directly (`apps/web/package.json:85,110`), but **do not** reach for `import { twMerge }` in app code — conflict resolution only becomes a convention while one implementation exists.

Naming follows `CODE_STANDARD.md` section 2: Tailwind first, `cn()` for anything dynamic or complex.

## Changing `packages/*/src` requires a rebuild

`apps/web` reads the sub-packages' `dist` (`main` at `packages/shared/package.json:17`, and every `exports` target points at `./dist/*`); `src` is not part of Vite's module graph. So:

```bash
pnpm --filter @antdv/shared build      # or @antdv/composables
# then restart dev: `pnpm dev:web` runs vite only, it does not build sub-packages
```

`turbo` gives `dev` / `build` a `dependsOn: ["^build"]`, so `pnpm dev` (through `turbo-run`) and a full `build` produce upstream dists first. But `pnpm dev:web` (`package.json:25`) is `pnpm --filter @antdv/web run dev` — **vite only**. Each package's own `dev` script is `tsdown --watch` (`packages/shared/package.json:10`); keep that running separately if you want edits to land as you save.

::: warning the symptom is "nothing changed, and nothing failed" You edit `packages/shared/src/**`, save, and behaviour and types stay exactly as they were, with no error, because Vite's dependency cache and `optimizeDeps` both point at `dist`. Build first, restart second; do not copy the implementation into the app to work around it. :::

## Related pages

- [Core concepts](/en/guide/essentials/concepts) — the full rationale for the layering and the two publish shapes
- [Caching](/en/guide/essentials/cache) — how `cache` works and how keys are built
- [State management](/en/guide/essentials/stores) — what deserves persistence, and the logout cleanup exit
- [Configuration](/en/guide/essentials/config) — `VITE_*` and the `configureSharedEnv` injection chain
- [Local development](/en/guide/essentials/development) — dev server and package watch
- [Unit testing](/en/guide/project/testing) — running the specs inside a package
