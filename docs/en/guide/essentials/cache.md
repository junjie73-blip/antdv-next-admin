# Caching

Persistence here is **hand-written**: there is no `pinia-plugin-persistedstate` (it is not in any dependency list and no store has a `persist` option). Everything that reaches disk goes through `packages/core/base/shared/src/cache/**` or straight into `localStorage`. So "which state survives" is an explicit decision, and each key still follows its own rule. This page covers the implementation, where keys come from, what really switches encryption on, and what happens when a value cannot be read back.

## The implementation: `packages/core/base/shared/src/cache/**`

| File | Contents |
| --- | --- |
| `index.ts` | the `createCache()` factory (`:60`), the module-level singleton `cache` (`:197`), the legacy wrapper `localStorageCacheStorage` (`:200-204`), `buildStorageKey` (`:40`) |
| `storage.ts` | three storage adapters and the `createStorage(type)` dispatch (`:56-68`), plus the singleton exports `localStorageAdapter` / `sessionStorageAdapter` / `memoryStorageAdapter` (`:70-72`) |
| `encrypt.ts` | SM4 via `sm-crypto`: async `encryptValue` / `decryptValue` (`:107,122`), sync `encryptValueSync` / `decryptValueSync` (`:135,144`), `shouldEncrypt()` (`:152`) |
| `tokenCrypto.ts` | token-only: `encryptToken` / `decryptToken` (`:77,106`) through a `jose` JWE — a completely separate mechanism from the SM4 above |
| `types.ts` | `StorageType` (`:4`), `CacheItem` (`:17`), `CacheStorage` (`:29`), `CacheInstance` (`:38`) |
| `memory.ts` | the `MemoryCache` class (`:16`) and the `memoryCache` singleton (`:95`) — `cache/index.ts` exports neither and nothing in the repo calls them. `tsdown.config.ts`'s `src/*/*.ts` does compile it to `dist/cache/memory.js`, so `@antdv/shared/cache/memory` resolves if you import it by hand — you just should not (see [Shared utilities](/en/guide/essentials/utils)) |

**There are only three storage media**: `'local'` / `'session'` / `'memory'` (`types.ts:4`; the switch at `storage.ts:56-68` has exactly those three cases). The `memory` adapter is a plain module-level `Map` (`storage.ts:4`) — not the timer-based class in `memory.ts`.

### Interface shape

`CacheInstance` (`types.ts:38-57`) has nine methods: `getItem` / `setItem` / `removeItem` / `hasItem` / `clear` / `keys` / `getExpire` / `setExpire` / `touch`. `clear()` and `keys()` are scoped to **the current prefix**, not to all of localStorage (`index.ts:136-150`).

`CacheStorage` (`types.ts:29-35`) declares `T | Promise<T>` returns to leave room for an async adapter, but **all three existing adapters are synchronous**; the `isPromise` checks at `index.ts:97-101,138-149` are purely defensive.

### TTL and serialization

- What lands on disk is not the bare value but an envelope `CacheItem`: `{ value, expire, createTime, time }` (`types.ts:17-26`, built at `index.ts:123-133`; `time` is a `@deprecated` compatibility field).
- In `setItem(key, value, expire?)` the **`expire` unit is seconds**; only `> 0` becomes `createTime + expire * 1000`, anything else is stored as `0` = never expires (`index.ts:127`).
- Expiry is **decided on read**, not by a timer: `getItem` finds `Date.now() > item.expire`, deletes the key and returns `null` (`index.ts:115-118`). `touch()` only extends entries that already had a deadline, defaulting to 3600 seconds (`index.ts:171-181`).
- The write chain is: `JSON.stringify(envelope)` → SM4 on top when encryption is on (a hex string) → handed to the adapter (`index.ts:82-85`). Any failure while reading is `catch`-ed into `null` (`index.ts:88-95`).

## Where keys come from: prefix + enum + each one's own literal

The real key is `` `${prefix}_${businessKey}` `` (`buildStorageKey`, `index.ts:40-45`). The prefix is injected by the app at startup:

```ts
// apps/web/src/bootstrap/env.ts:1-7 (verbatim)
import { configureSharedEnv } from '@antdv/shared/utils/env';
configureSharedEnv({
  cacheEncryptKey: import.meta.env.VITE_CACHE_ENCRYPT_KEY,
  cachePrefix: import.meta.env.VITE_APP_TITLE ?? 'app_cache',
  minioPublicUrl: import.meta.env.VITE_MINIO_PUBLIC_URL,
  production: import.meta.env.PROD,
});
```

Two details matter: the prefix **contains a space** (`VITE_APP_TITLE` verbatim, whose value in `apps/web/.env:2` is `Antdv Admin`, so keys such as `Antdv Admin_auth_token` really exist on disk), and the fallback when nothing was injected is `'app_cache'` (`packages/core/base/shared/src/utils/env.ts:27`). Also, the prefix and the encryption flag are **re-resolved on every read and write** rather than frozen when the instance is created (`index.ts:68-78`), because `export const cache = createCache()` runs during module evaluation and therefore always before `configureSharedEnv()`. A regression spec pins that ordering (`packages/core/base/shared/__tests__/cache.test.ts:147-183`).

### The `CacheKey` enum

`packages/enums/src/cache.ts:8-16` defines four members, and every one of them is actually referenced: `DICT_DATA` (`apps/web/src/stores/modules/dict.ts:35,49,133`), `ACCESS_TOKEN` (destructured as `TOKEN_KEY` in `packages/stores/src/user.ts:14`), `REFRESH_TOKEN` (`apps/web/src/plugins/request-runtime.ts:22,24`) and `USER_INFO` (destructured as `USER_INFO_KEY` in `user.ts:14`). The enum values *are* the on-disk key names (`auth_token` / `refresh_token` / `user_info` / `antdv_dict_data`), matching what the app writes, so the enum can serve as the single source of truth — the comment at the top of that file says to check that both the writer and the reader use it before adding a member.

**There is no `ROLES`, `PERMISSIONS`, `THEME`, `SIDEBAR` or `LOCALE`.** Roles and permissions live in the user store's in-memory state (persisted as part of `user_info`), preferences (theme and language included) have their own `appSetting` entry, and menu-visibility overrides go through bare `localStorage` (see the table below) — none of them occupies a `CacheKey`. After the language-switching change the locale is not stored separately either; it only lives inside the preferences snapshot, and the test asserts exactly that: persistence is a single copy and `app_cache_locale` must be `null` (`apps/web/src/locales/__tests__/locale.spec.ts:80-82`).

Keys that really exist on disk:

| Real key (without prefix) | Written by | How | Source |
| --- | --- | --- | --- |
| `auth_token` | user store | Both login and refresh go through `setToken`; the value passes through `encryptToken` (JWE) before it enters the cache, with the default `TOKEN_EXPIRE` TTL (24h). **It only falls back to plaintext when encryption itself throws** (`:143-144`) | `packages/stores/src/user.ts:56,60,136,144` |
| `user_info` | user store | `cache.setItem`, no TTL | `user.ts:14,65` |
| `refresh_token` | **the request layer only** | `cache.setItem`, **unencrypted, no TTL** (unlike the access token) | `apps/web/src/plugins/request-runtime.ts:24`; the name is `CacheKey.REFRESH_TOKEN` (`packages/enums/src/cache.ts`) |
| `tabsState` | tabs store | full write-back inside a `watch` | `packages/stores/src/tabs.ts:16,42-51` |
| `antdv_dict_data` | dict store | goes through `localStorageCacheStorage`, and **adds a second** `loadedAt` 1-hour check on top of the envelope | `apps/web/src/stores/modules/dict.ts:35,48-49`, `packages/enums/src/cache.ts` |
| `appSetting` | preferences (its own `createCache`) | `PREFERENCES_CACHE_KEY`; with `options.expire` left out it never expires | `packages/core/preferences/src/constants.ts:11`, `preferences.ts:31-32,71-73` |
| `xy-menu-hidden-overrides` | route store | **bare `localStorage` + bare JSON**, no cache, no prefix | `packages/stores/src/route.ts:26,30,42` |
| `chunk-upload:<hash>` | upload component | **bare `localStorage`**, its own `updatedAt` with a 7-day window | `apps/web/src/components/common/Upload/constants.ts:8-9`, `apps/web/src/components/common/Upload/utils.ts:50-52,56-60` |

`apps/web/src/config/constants.ts` now holds only the route whitelist and two paths (`WHITE_LIST` / `HOME_PATH` / `LOGIN_PATH`); its header comment hands cache key names over to `@antdv/enums` — "cache key names do not live here, they are all in `CacheKey` in `@antdv/enums`". The older `TOKEN_EXPIRES_IN` / `REFRESH_TOKEN_EXPIRE` / `PERMISSIONS_KEY` trio has been deleted from that file and has no reference anywhere, so do not go looking for key names there on the strength of old docs. The expiry constant actually in use is the local `TOKEN_EXPIRE` at `packages/stores/src/user.ts:15` (`24 * 60 * 60`, seconds). `VITE_NAMESPACE` survives only as a type declaration in `apps/web/types/env.d.ts:28`, has no reader, and never joins into a key (see [Configuration](/en/guide/essentials/config)).

## Encryption: SM4 only in production builds, and the key is not the one you expect

`shouldEncrypt()` is `isProduction()` (`encrypt.ts:152-154` → `env.ts:50-52`), and `production` comes from `import.meta.env.PROD` at `bootstrap/env.ts:6`. **There is no separate encryption switch**: dev is always plaintext, build is always ciphertext, and whether `VITE_CACHE_ENCRYPT_KEY` is set changes nothing in that decision. To opt out per instance you pass `createCache({ encrypt: false })` (`index.ts:63,76`).

::: warning

the SM4 key for cached values is the prefix, not `VITE_CACHE_ENCRYPT_KEY` `index.ts:82-85` passes **the resolved prefix as the key** into `encryptValueSync(json, prefix)`, and `encryptValueSync` is implemented as `padKey(key || getBaseKey())` (`encrypt.ts:135-136`). `key` is never empty, so the `getBaseKey()` / `getCacheEncryptKey()` chain is **unreachable on the cache path**. Three consequences:

1. `VITE_CACHE_ENCRYPT_KEY` (`apps/web/.env.production:15`) takes no part in encrypting cached values; the Configuration page calls it "the cache encryption key" (`en/guide/essentials/config.md:38`), and in code it is only stored by `configureSharedEnv` (`env.ts:36-38`) — the cache path never reads it.
2. Missing it in production does **not** trigger the "a key is required" throw at `env.ts:59-68`; that branch is dead code for caching.
3. The SM4 key is `padKey(VITE_APP_TITLE)` (padded or truncated to 32 characters, `encrypt.ts:18,93-98`), which means **changing the title changes the key names and the key together**, and any project reusing the same title reuses the same key.

The derived-key machinery (SHA-256 over a device fingerprint, `encrypt.ts:40-75`) only serves the async `encryptValue` / `decryptValue`, and **nothing in the repository calls those two functions**.
:::

The token value has its own mechanism, independent of `shouldEncrypt`: `encryptToken()` builds a `jose` `EncryptJWT` with `alg: 'dir'` + `A256GCM` (`tokenCrypto.ts:86-90`), keyed by PBKDF2 (100 000 iterations) over a **device fingerprint** (`tokenCrypto.ts:21-69`) whose factors are `navigator.userAgent`, `navigator.language`, `screen.width/height` and the timezone offset (`:22-28`). It encrypts in dev too, which is why tokens in your local localStorage are JWE strings.

## How stores use it, and the cleanup exit on logout

There is exactly one aggregated exit: `useUserStore().logout()` (`packages/stores/src/user.ts:164-169`) — empty the in-memory state, `cache.removeItem(TOKEN_KEY)` + `cache.removeItem(USER_INFO_KEY)`, then `clearDerivedSession()` (`:85-89`, which calls `notifySessionReset()` so externally registered cleanups such as the page-cache registry clear themselves, then `useRouteStore().resetRoutes()` and `useTabsStore().reset()`). `forceLogout()` in the request layer does not clean anything itself — it calls the injected `onLogout` (`packages/request/src/fetcher.ts:73-76`), and the app wires `logout()` back in (`apps/web/src/plugins/request-runtime.ts:18`). Anything new that must be cleared on sign-out is registered through `onSessionReset` rather than bolted onto the logout flow.

| Read / write point | Location |
| --- | --- |
| Stores read the cache while initialising | `packages/stores/src/user.ts:19-23`, `tabs.ts:25,34`, `apps/web/src/stores/modules/dict.ts:56` (`loadFromStorage()`) |
| Writes after a change | `user.ts:60,65` (setToken / setUserInfo), `packages/stores/src/tabs.ts:42-51`, `dict.ts:49`, `packages/core/preferences/src/preferences.ts:71-73` (commit persists) |
| Request layer reads tokens as a fallback | `packages/request/src/fetcher.ts:96,102,193-194,214,222` |
| Manual "clear cache and sign out" | `packages/layouts/src/widgets/setting-drawer/components/setting-footer.vue:47-49`: `cache.clear()` + `localStorage.clear()` + `sessionStorage.clear()` |

::: warning

two places along that chain still do not line up (read from the code, not guessed)

- **`logout()` never clears `refresh_token`**: `user.ts:164-169` only removes `auth_token` and `user_info`, so the `refresh_token` written at `request-runtime.ts:24` stays on disk (only a full `cache.clear()` takes it away).
- **The login flow never writes `refresh_token`**: the login response handled in `user.ts` carries only `user.token` (`:96-104`) and nothing calls `setRefresh`, so the first `doRefreshToken()` reaches `tokens.refresh()` returning empty → `缺少 refresh token` (`fetcher.ts:96-97`).

Two defects that used to sit here are now fixed, so stop looking for them in the old wording: `initToken()` is awaited at `main.ts:168`, so after a reload `token.value` holds the plaintext **after** `decryptToken`, not the JWE string (regression spec `packages/stores/__tests__/user-session.test.ts:166-212`); and refresh tokens go through `setRefresh` at `request-runtime.ts:24` (`cache.setItem`, plaintext, no TTL) instead of abusing the second parameter of `setToken` as an expiry. One thing is still open: `clearDict()` has no call site anywhere, so logout does not clear dictionaries — they rely on the 1-hour `loadedAt` window expiring on its own (`apps/web/src/stores/modules/dict.ts:39,133`).
:::

## Which browser storage is actually used

| Medium | Status |
| --- | --- |
| `localStorage` | The main battlefield: the default cache medium, plus two bare uses (`packages/stores/src/route.ts:30,42`, `apps/web/src/components/common/Upload/utils.ts:56,83,91`) |
| `sessionStorage` | **Adapter exists, nobody uses it.** `createStorage('session')` only produces the `sessionStorageAdapter` export at `storage.ts:71`; no `createCache({ type: 'session' })` exists in the app, and the only session operation in app code is the `clear()` in SettingFooter |
| `memory` | `type: 'memory'` appears only in `packages/core/base/shared/__tests__/cache.test.ts:137`; the app never uses it |
| IndexedDB | **None.** `indexedDB` has zero hits in source; the only place it shows up is the workbox runtime inside the build output when the PWA is on (`VITE_PWA`, `apps/web/dist/workbox-*.js`), which has nothing to do with app state |

## The cost of invalidation

After you change the prefix (`VITE_APP_TITLE`) or the encryption shape, old cache entries silently become unreadable:

- `deserialize` catches decryption failures and JSON parse failures alike and returns `null` (`index.ts:88-95`), and `getItem` maps `null` to `null` (`:107-109`) — indistinguishable from "nothing cached".
- What the user sees: no token comes back → the guard treats the session as signed out → back to the login page; no preferences come back → `readSaved()`'s `try/catch` yields `undefined` (`packages/core/preferences/src/preferences.ts:62-69`) → the UI silently falls back to defaults; no tabs come back → an empty tab bar. Nothing anywhere says "the prefix or the key rejected this".
- **Old keys become orphans**: `clear()` only removes keys whose name starts with the current prefix (`index.ts:136-143`), so after a prefix change the old data can never be cleared through `cache` — only a full `localStorage.clear()` gets rid of it (which is exactly what that SettingFooter button does).
- The same applies across modes: plaintext written in dev cannot be decrypted in a build, and data written under another prefix cannot be decrypted with the new key — `cache.test.ts:106-118` is the spec that pins "decrypting with a different prefix fails and degrades to `null`".
- The token chain has a subtler failure mode: when the device fingerprint changes (browser upgrade, timezone change, screen size / rotation, a different `navigator.language`) the derived key changes, and `decryptToken` returns `null` for a JWE string (`tokenCrypto.ts:106-139`; only legacy plaintext without a `.` falls back). It shows up as "signed out for no reason".

::: tip

before you add another piece of persisted state Decide the key first. Application-scoped state follows `dict.ts`: add a `CacheKey` member (and actually reference it), `cache.setItem` inside a `watch`, and add the cleanup to `logout()` in `user.ts`. Purely visual preferences must not open their own key — they belong to `packages/core/preferences` (see [State management](/en/guide/essentials/stores)). Bare `localStorage` is for data that has nothing to do with cache semantics (menu visibility overrides, upload resume progress), and it must carry its own expiry check.
:::

## Related pages

- [State management](/en/guide/essentials/stores) — the six stores and who persists what
- [Utilities](/en/guide/essentials/utils) — which layer `cache` lives in and how it gets reused
- [Configuration](/en/guide/essentials/config) — `VITE_APP_TITLE` / `VITE_CACHE_ENCRYPT_KEY` and the injection chain
- [Core concepts](/en/guide/essentials/concepts) — why packages may not read `import.meta.env`
- [FAQ](/en/guide/other/faq)
