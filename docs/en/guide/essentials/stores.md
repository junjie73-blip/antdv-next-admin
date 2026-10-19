# State management

The state layer is **Pinia plus a hand-written cache**: no persistence plugin lives inside the stores — everything that hits disk goes through `cache` from `@antdv/shared` (or `localStorage` directly). This differs from most templates: there is no `pinia-plugin-persistedstate`, so "which state survives" is an explicit decision rather than a `persist: true` switch.

```ts
// apps/web/src/main.ts:58-59
const pinia = createPinia();
app.use(pinia);
```

`createPinia` / `defineStore` are in the auto-import `imports` list (`['vue', '@vueuse/core', 'pinia', VueRouterAutoImports]` at `internal/vite-config/src/plugins/auto-import.ts:24`), so store files work without writing the import. Components are **not** in this scope — sub-package components and antdv-next components are always imported explicitly, see [External modules](/en/guide/essentials/external).

## Six stores, living in two places

| store | id / location | what it owns | consumers |
| --- | --- | --- | --- |
| user | `packages/stores/src/user.ts:17` | login / logout / token / refreshToken / roles / permissions / `hasPermission` | `views/login/index.vue:41`, request-layer runtime `plugins/request-runtime.ts:18-23`, route guards `router/guards/index.ts:49`, `utils/ws.ts:341`, permission directive `directives/index.ts:35` |
| route | `packages/stores/src/route.ts:48` | `backendMenus` / `menus` / `allowedNames` / `allowedPaths` / `isLoaded` | dynamic-route guards (`router/guards/index.ts:59-82`), the menu-management page |
| app | `packages/stores/src/app.ts:23` | a **derived view** of preferences: flattens them into refs + `updateSetting` + `toggles` | `App.vue:12`, `packages/layouts/src/basic/layout.vue:41` and the settings drawer |
| tabs | `packages/stores/src/tabs.ts:34` | tab list, `activeKey`, `maximizedKey` | `packages/layouts/src/hooks/use-tabs.ts:39`, `use-layout.ts:153`, `use-page-cache.ts:78` |
| dict | `apps/web/src/stores/modules/dict.ts:55` | dictionary map + `getOptions` / `getLabel` | fetched at startup in `apps/web/src/layouts/index.vue:32`, read by the system-management pages |
| auth | `apps/web/src/stores/modules/auth.ts:13` | token + userInfo + roles (**duplicates user, zero consumers repo-wide**) | nobody, see the warning below |

The first four live in `@antdv/stores` (`packages/stores/src/`); the last two are app-private stores in `apps/web/src/stores/modules/`. This boundary is hard: only these two locations ever call `defineStore`; the rest of `packages/*` (layouts, ui-kit, hooks…) has **none** — a shared package that needs state takes it in via props / inject, it may not spin up its own store.

`packages/stores/src/session.ts` is not a store, it is the **session-reset registry**: `onSessionReset(handler)` registers, `notifySessionReset()` runs them in order (`session.ts:18-21`, `:29-37`). Derived state that lives in a *different* package — like the page cache — clears through it (`packages/layouts/src/hooks/use-page-cache.ts:74`); importing that package directly would invert the dependency direction (stores → layouts) and cycle the package graph.

::: warning Two barrels, don't use the wrong one The `@antdv/stores` barrel exports all five modules: `packages/stores/src/index.ts:1-5` (app / route / session / tabs / user). `apps/web/src/stores/index.ts:1-2` only re-exports auth / dict, so those four are **not** reachable via `~/stores` — app code does `import { useUserStore } from '@antdv/stores'` uniformly, and private stores come from `~/stores`. :::

## Conventions

- **All setup stores**: `defineStore(id, () => { ... })`, getters returned as `computed`, actions as named functions, everything `return { ... }` at the end (`auth.ts:13-44`, `route.ts:421-438`). No option-store syntax.
- Naming `useXxxStore`; file name matches the id.
- **Use outside a component**: there is no `pinia`-instance injection trick; stores are called lazily inside functions / guard callbacks (`router/guards/index.ts:49`, `plugins/request-runtime.ts:18`, `directives/index.ts:35`). That means you cannot grab a store at module top level — pinia isn't installed yet.
- Logout has a single aggregated exit: `user.ts:163-169` first nulls the token and user info, removes two cache keys, then calls `clearDerivedSession()` (`:85-89`), which runs `notifySessionReset()` (page cache and other external registrations), `useRouteStore().resetRoutes()`, `useTabsStore().reset()` in turn. Register new state you need to clean via `onSessionReset`; don't scatter it through the logout flow.

## Persistence: hand-written, and each key has its own rules

The `cache` join rule is `` `${prefix}_${key}` ``, where prefix is injected at startup by `apps/web/src/bootstrap/env.ts:4` from `VITE_APP_TITLE` (actual value `Antdv Admin`, `apps/web/.env:2`) and is **re-resolved on every read and write** (`packages/core/base/shared/src/cache/index.ts:40-45,75`). In production the written value is SM4-encrypted (`packages/core/base/shared/src/cache/encrypt.ts:152-154`); in development it is plaintext.

| persisted content | key | how | source of truth |
| --- | --- | --- | --- |
| access token / user info | `auth_token` / `user_info` | `encryptToken` then write, token expires in 24h | `packages/enums/src/cache.ts:7-16`, `user.ts:14-15,56-66` |
| refresh token | `refresh_token` | read and write both live in the callback injected by the request-layer runtime | `plugins/request-runtime.ts:22,24` |
| tabs | `tabsState` | `cache.setItem` inside a `watch` | `tabs.ts:16,42-51` |
| dictionaries | `antdv_dict_data` (one key for the whole table) | `localStorageCacheStorage` + a **1-hour TTL** (its own `loadedAt` field) | `dict.ts:33-53`, `cache/index.ts:200-204` |
| menu "navigation visibility" overrides | `xy-menu-hidden-overrides` | bare `localStorage`, no cache prefix, no encryption | `route.ts:26,38-46` |
| preferences (incl. `locale`) | `appSetting` (prefixed) | the preferences instance persists itself, writing on every commit | `preferences.ts:31-32,71-77,87-97` |

::: warning `VITE_NAMESPACE` is a dead variable it only appears in `apps/web/.env:1`, `apps/web/types/env.d.ts:28` and this document — **no code path reads it**. To isolate localStorage per environment you currently only have the `VITE_APP_TITLE` prefix (changing the title invalidates all old caches; that is its real effect). Don't expect a namespace to give you per-tab isolation. :::

## The app store is a façade over preferences, not a second copy of state

Real ownership sits in `packages/core/preferences`: `createPreferences()` hands back a set of refs/computed (`packages/core/preferences/src/preferences.ts:27`), and `updateSetting` / `toggle` persist synchronously after `commit()` and write the DOM (`:87-97`, the actual DOM write is in `update-css-variables.ts`). `app.ts:29-97` uses `pick()` / `toRef` to **flatten** it into read-only refs like `appStore.primaryColor`, and `app.ts:102-126` exposes `updateSetting`, `resetSetting`, `toggles.*` as the write API.

There is no second source of truth for language: `locale` is just one field in the preferences snapshot (`app.ts:97`), the only write path is `appStore.updateSetting({ locale })`, after which `useLocaleSync` expands it into four things — i18n messages, `<html lang>`, dayjs and component built-in text (`apps/web/src/composables/useLocale.ts:32-61`). The `locale: 'zh-CN'` in `apps/web/src/locales/index.ts:11-19` is only the `createI18n` initial value, not a second source of truth.

So:

- read a setting → `appStore.xxx` (or `appStore.appSetting` for the whole snapshot)
- write a setting → `appStore.updateSetting({...})` / `appStore.toggles.xxx()`
- do **not** add new `ref`s holding business state inside the app store — it is the façade layer for preferences
- to tell dark from light use `resolvedTheme` / `isSystemDark` (`app.ts:43-51`, `packages/utils/src/theme-mode.ts:14-21`), because the default is `theme: 'auto'`, so `appStore.theme` may be `'auto'`

See [Theming & preferences](/en/guide/in-depth/theme).

## Should it go in a store, or not

| situation | where |
| --- | --- |
| survives routes, must be there after refresh (login, menus, tabs, preferences, dictionaries) | store + explicit persistence |
| survives routes, may be gone after refresh (page-cache set, request loading) | store, not persisted |
| only the parent and child component need it | `provide` / `inject` or props, keep it out of global |
| one page's form draft | a component-local `ref` |

::: tip Adding a new store Write app-level state following `apps/web/src/stores/modules/dict.ts`; only cross-package-shared state goes into `packages/stores/src/`: a setup store, a stable id as the first arg of `defineStore('xxx')`, explicit `cache.setItem` in a `watch` when it must persist, add the key to `CacheKey` in `packages/enums/src/cache.ts`, and hook cleanup into logout (or register via `onSessionReset`). Don't forget to sync the exports in `packages/stores/src/index.ts` or `apps/web/src/stores/index.ts`. :::
