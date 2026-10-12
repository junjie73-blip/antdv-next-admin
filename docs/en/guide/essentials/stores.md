# State management

The state layer is **Pinia plus a hand-written cache**: stores carry no persistence plugin, and everything that reaches disk goes through `cache` from `@antdv/shared` (or `localStorage` directly). This is where the project differs from most templates — there is no `pinia-plugin-persistedstate`, so "which state survives" is an explicit decision rather than a `persist: true` switch.

```ts
// apps/web/src/main.ts:44-45
const pinia = createPinia();
app.use(pinia);
```

`createPinia` / `defineStore` are also registered by auto-import (`internal/vite-config/src/plugins/auto-import.ts:77`), so a store file works without a visible import.

## Six stores in total

All of them are in `apps/web/src/stores/modules/`, and `packages/*` has **none at all** (shared packages may not touch stores).

| store | id / location | what it manages | who consumes it |
| --- | --- | --- | --- |
| user | `user.ts:18` | login / logout / token / refreshToken / roles / permissions / `hasPermission` | `views/login/index.vue:23`, the request layer `fetcher.ts:75`, route guards, `utils/ws.ts:339` |
| route | `route.ts:49` | `backendMenus` / `menus` / `allowedNames` / `allowedPaths` / `isLoaded` | the dynamic route guard (`router/guards/index.ts:53-95`), the menu management page |
| app | `app.ts:20` | a **derived view** of the preferences: flattens preferences into refs plus `updateSetting` plus `toggles` | `App.vue:18`, the layout and the settings drawer |
| tabs | `tabs.ts:33` | the tab list, `activeKey`, `maximizedKey` | `useTabs.ts:37`, `useLayout.ts:163`, `usePageCache.ts:67` |
| dict | `dict.ts:55` | dictionary map + `getOptions` / `getLabel` | fetched at startup in `layouts/index.vue:153` |
| auth | `auth.ts:13` | token + userInfo + roles (**duplicates user, zero consumers in the repo**) | used by nobody, see the warning below |

::: warning `stores/index.ts` only re-exports four `stores/index.ts:1-4` export app / auth / dict / route, so **tabs and user must be imported straight from `~/stores/modules/*`**. This is not a typo, it is a leftover convergence gap, already on the to-do list. :::

## Conventions

- **All setup stores**: `defineStore(id, () => { ... })`, getters returned as `computed`, actions returned as named functions (`auth.ts:18-43`, `route.ts:354-371`). There is no option store style anywhere.
- Naming is `useXxxStore`, and the file name corresponds to the id.
- **Using a store outside components**: there is no pinia-instance injection trick; the store is called on the spot inside function/guard callbacks (`router/guards/index.ts:53`, `fetcher.ts:75`, `directives/index.ts:35`). That means you cannot grab a store at module top level — pinia has not been installed yet at that point.
- Logout has exactly one aggregated exit: `user.ts:126-150` runs `resetPageCache()`, `useRouteStore().resetRoutes()`, `useTabsStore().reset()` in that order. State that needs clearing on logout gets added here, not scattered all over the place.

## Persistence: hand-written, and every key follows its own rule

The key rule of `cache` is `` `${prefix}_${key}` ``: the prefix is injected at startup by `apps/web/src/bootstrap/env.ts:4` from `VITE_APP_TITLE` (actual value `Antdv Admin`, `apps/web/.env:2`) and **is re-resolved on every read and write** (`packages/shared/src/cache/index.ts:40-45,75`). In production the written values are SM4-encrypted (`packages/shared/src/cache/encrypt.ts:152-154`).

| What is persisted | key | How it is written | Source of truth |
| --- | --- | --- | --- |
| token / user info | `auth_token` / `refresh_token` | written after `encryptToken`, token expires in 24h | `user.ts:14-15,51-61` |
| tab pages | `tabsState` | `cache.setItem` inside a `watch` | `tabs.ts:15,41-50` |
| dictionaries | per dictionary code | `localStorageCacheStorage` + **1 hour TTL** | `dict.ts:33-53` |
| menu "show in navigation" overrides | `xy-menu-hidden-overrides` | bare `localStorage`, no cache prefix | `route.ts:27,39-47` |
| preferences | `appSetting` (prefixed) | the preferences store persists on its own | `packages/preferences/src/store.ts:104-105,144-150` |
| language | `locale` | **bare key**, a separate thing from the preferences `locale` | `src/locales/index.ts:11`, `composables/web/useLocale.ts:20-25` |

::: warning `VITE_NAMESPACE` is a dead variable It only appears in `apps/web/.env:1`, `types/env.d.ts:31`, and this document; **no code path reads it**. Isolating localStorage per environment currently only works through the `VITE_APP_TITLE` prefix (changing the title invalidates every old cache entry, which is its real effect). Don't expect a namespace setting to give you per-tab isolation. :::

## The app store is a facade over the preferences, not a second copy of state

Ownership really sits in `packages/preferences`: `createPreferences()` hands back a set of refs/computed, and `updateSetting` / `toggle` persist synchronously after committing and write the DOM (`store.ts:99-214,160-168`). `app.ts:28-95` uses `pick()` / `toRef` to **flatten** it into read-only refs like `appStore.primaryColor`, and `app.ts:100-124` then exposes `updateSetting` and `toggles.*` as the write API.

So:

- Read a setting → `appStore.xxx` (or `appStore.appSetting` for the whole object)
- Write a setting → `appStore.updateSetting({...})` / `appStore.toggles.xxx()`
- **Don't** add new `ref`s holding business state in the app store; that layer is a facade for preferences
- To tell whether the current mode is dark or light, use `resolvedTheme` / `isSystemDark` (`app.ts:41-48`, `theme-mode.ts:15-21`), because the default is `theme: 'auto'` and `appStore.theme` may be `'auto'`

Details in [Theme and preferences](/en/guide/in-depth/theme).

## Store or not

| Situation | Where it goes |
| --- | --- |
| Survives routes and must survive a reload (auth state, menus, tab pages, preferences, dictionaries) | store + explicit persistence |
| Survives routes but may be gone after a reload (page cache set, request loading) | store, no persistence |
| Only a parent component and its child need it | `provide` / `inject` or props, keep it out of the global scope |
| A form draft for one page | a `ref` inside the component |

::: tip Adding a new store Copy `dict.ts`: a setup store, a stable id as the first argument in the `defineStore('dict')` style, an explicit `cache.setItem` in a `watch` when it has to reach disk, and a cleanup step added to the logout flow in `user.ts`. Don't forget to update the exports in `stores/index.ts`, or import it directly as `~/stores/modules/xxx`. :::
