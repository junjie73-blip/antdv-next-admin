# Caching

Persistence here is **hand-written**: there is no `pinia-plugin-persistedstate` (it is not in any dependency list and no store has a `persist` option). Everything that reaches disk goes through `packages/shared/src/cache/**` or straight into `localStorage`. So "which state survives" is an explicit decision, and each key still follows its own rule. This page covers the implementation, where keys come from, what really switches encryption on, and what happens when a value cannot be read back.

## The implementation: `packages/shared/src/cache/**`

| File | Contents |
| --- | --- |
| `index.ts` | the `createCache()` factory (`:60`), the module-level singleton `cache` (`:196`), the legacy wrapper `localStorageCacheStorage` (`:199-203`), `buildStorageKey` (`:40`) |
| `storage.ts` | three storage adapters and the `createStorage(type)` dispatch (`:56-68`), plus the singleton exports `localStorageAdapter` / `sessionStorageAdapter` / `memoryStorageAdapter` (`:70-72`) |
| `encrypt.ts` | SM4 via `sm-crypto`: async `encryptValue` / `decryptValue` (`:107,122`), sync `encryptValueSync` / `decryptValueSync` (`:135,144`), `shouldEncrypt()` (`:152`) |
| `tokenCrypto.ts` | token-only: `encryptToken` / `decryptToken` (`:77,106`) through a `jose` JWE — a completely separate mechanism from the SM4 above |
| `types.ts` | `StorageType` (`:4`), `CacheItem` (`:17`), `CacheStorage` (`:29`), `CacheInstance` (`:38`) |
| `memory.ts` | the `MemoryCache` class (`:16`) — **not exported by `index.ts`, not a tsdown entry, unreachable from outside**; dead code |

**There are only three storage media**: `'local'` / `'session'` / `'memory'` (`types.ts:4`; the switch at `storage.ts:56-68` has exactly those three cases). The `memory` adapter is a plain module-level `Map` (`storage.ts:4`) — not the timer-based class in `memory.ts`.

### Interface shape

`CacheInstance` (`types.ts:38-57`) has nine methods: `getItem` / `setItem` / `removeItem` / `hasItem` / `clear` / `keys` / `getExpire` / `setExpire` / `touch`. `clear()` and `keys()` are scoped to **the current prefix**, not to all of localStorage (`index.ts:136-150`).

`CacheStorage` (`types.ts:29-35`) declares `T | Promise<T>` returns to leave room for an async adapter, but **all three existing adapters are synchronous**; the `isPromise` checks at `index.ts:97-101,138-149` are purely defensive.

### TTL and serialization

- What lands on disk is not the bare value but an envelope `CacheItem`: `{ value, expire, createTime, time }` (`types.ts:17-26`, built at `index.ts:122-132`; `time` is a `@deprecated` compatibility field).
- In `setItem(key, value, expire?)` the **`expire` unit is seconds**; only `> 0` becomes `createTime + expire * 1000`, anything else is stored as `0` = never expires (`index.ts:126`).
- Expiry is **decided on read**, not by a timer: `getItem` finds `Date.now() > item.expire`, deletes the key and returns `null` (`index.ts:114-117`). `touch()` only extends entries that already had a deadline, defaulting to 3600 seconds (`index.ts:170-180`).
- The write chain is: `JSON.stringify(envelope)` → SM4 on top when encryption is on (a hex string) → handed to the adapter (`index.ts:81-84`). Any failure while reading is `catch`-ed into `null` (`index.ts:87-94`).

## Where keys come from: prefix + enum + each one's own literal

The real key is `` `${prefix}_${businessKey}` `` (`buildStorageKey`, `index.ts:40-45`). The prefix is injected by the app at startup:

```ts
// apps/web/src/bootstrap/env.ts:1-7 (verbatim)
import { configureSharedEnv } from '@antdv/shared/env';
configureSharedEnv({
  cacheEncryptKey: import.meta.env.VITE_CACHE_ENCRYPT_KEY,
  cachePrefix: import.meta.env.VITE_APP_TITLE ?? 'app_cache',
  minioPublicUrl: import.meta.env.VITE_MINIO_PUBLIC_URL,
  production: import.meta.env.PROD,
});
```

Two details matter: the prefix **contains a space** (`VITE_APP_TITLE` verbatim, whose value in `apps/web/.env:2` is `Antdv Admin`, so keys such as `Antdv Admin_auth_token` really exist on disk), and the fallback when nothing was injected is `'app_cache'` (`packages/shared/src/env.ts:27`). Also, the prefix and the encryption flag are **re-resolved on every read and write** rather than frozen when the instance is created (`index.ts:68-78`), because `export const cache = createCache()` runs during module evaluation and therefore always before `configureSharedEnv()`. A regression spec pins that ordering (`packages/shared/__tests__/cache.test.ts:147-183`).

### Only part of the `CacheKey` enum is in use

`apps/web/src/enums/cache.ts:2-19` declares eight members, but **only `DICT_DATA` is referenced by code** (`stores/modules/dict.ts:6,35,49,133`). The other seven (`ACCESS_TOKEN` / `REFRESH_TOKEN` / `USER_INFO` / `ROLES` / `PERMISSIONS` / `THEME` / `SIDEBAR`) have no reference anywhere in the repository, and their values (`app_cache_access_token`) are not the keys the app actually writes (`auth_token`) — so do not treat the enum as the single source of truth for cache keys.

**There is no `LOCALE`.** After the language-switching change, the locale is not stored on its own; it only lives inside the preferences snapshot, and the test asserts exactly that: persistence is a single copy and `app_cache_locale` must be `null` (`apps/web/src/locales/__tests__/locale.spec.ts:100-104`).

Keys that really exist on disk:

| Real key (without prefix) | Written by | How | Source |
| --- | --- | --- | --- |
| `auth_token` | user store / request layer | The login path runs the value through `encryptToken` (JWE) before it enters the cache, with a 24h TTL; **the refresh path calls `cache.setItem(TOKEN_KEY, newAccess)` unencrypted** and passes no TTL | `stores/modules/user.ts:14,55,106`, `fetcher.ts:129` |
| `user_info` | user store | `cache.setItem`, no TTL | `user.ts:15,60` |
| `refresh_token` | **the request layer only** | `cache.setItem`, no TTL | `fetcher.ts:130`; the name comes from `config/constants.ts:4` |
| `tabsState` | tabs store | full write-back inside a `watch` | `stores/modules/tabs.ts:15,41-50` |
| `antdv_dict_data` | dict store | goes through `localStorageCacheStorage`, and **adds a second** `loadedAt` 1-hour check on top of the envelope | `dict.ts:35,49`, `enums/cache.ts:4` |
| `appSetting` | preferences (its own `createCache`) | `PREFERENCES_CACHE_KEY`, never expires | `packages/preferences/src/store.ts:21,104,146` |
| `xy-menu-hidden-overrides` | route store | **bare `localStorage` + bare JSON**, no cache, no prefix | `stores/modules/route.ts:27,31,43` |
| `chunk-upload:<hash>` | upload component | **bare `localStorage`**, its own `updatedAt` with a 7-day window | `components/common/Upload/constants.ts:8-9`, `Upload/utils.ts:50-52,56-60` |

`TOKEN_EXPIRES_IN` / `REFRESH_TOKEN_EXPIRE` / `PERMISSIONS_KEY` in `config/constants.ts` are referenced nowhere (the three hits for `TOKEN_EXPIRE` are the identically named local constant in `user.ts:16`). `VITE_NAMESPACE` is likewise never read and never joins into a key (see [Configuration](/en/guide/essentials/config)).

## Encryption: SM4 only in production builds, and the key is not the one you expect

`shouldEncrypt()` is `isProduction()` (`encrypt.ts:152-154` → `env.ts:48-50`), and `production` comes from `import.meta.env.PROD` at `bootstrap/env.ts:6`. **There is no separate encryption switch**: dev is always plaintext, build is always ciphertext, and whether `VITE_CACHE_ENCRYPT_KEY` is set changes nothing in that decision. To opt out per instance you pass `createCache({ encrypt: false })` (`index.ts:63,76`).

::: warning the SM4 key for cached values is the prefix, not `VITE_CACHE_ENCRYPT_KEY` `index.ts:81-84` passes **the resolved prefix as the key** into `encryptValueSync(json, prefix)`, and `encryptValueSync` is implemented as `padKey(key || getBaseKey())` (`encrypt.ts:135-136`). `key` is never empty, so the `getBaseKey()` / `getCacheEncryptKey()` chain is **unreachable on the cache path**. Three consequences:

1. `VITE_CACHE_ENCRYPT_KEY` (`apps/web/.env.production:14`) takes no part in encrypting cached values; `config.md:53` calls it "the cache encryption key", and in code it is only stored by `configureSharedEnv` (`env.ts:34-36`) — the cache path never reads it.
2. Missing it in production does **not** trigger the "a key is required" throw at `env.ts:57-66`; that branch is dead code for caching.
3. The SM4 key is `padKey(VITE_APP_TITLE)` (padded or truncated to 32 characters, `encrypt.ts:18,93-98`), which means **changing the title changes the key names and the key together**, and any project reusing the same title reuses the same key.

The derived-key machinery (SHA-256 over a device fingerprint, `encrypt.ts:40-75`) only serves the async `encryptValue` / `decryptValue`, and **nothing in the repository calls those two functions**. :::

The token value has its own mechanism, independent of `shouldEncrypt`: `encryptToken()` builds a `jose` `EncryptJWT` with `alg: 'dir'` + `A256GCM` (`tokenCrypto.ts:86-90`), keyed by PBKDF2 (100 000 iterations) over a **device fingerprint** (`tokenCrypto.ts:21-69`) whose factors are `navigator.userAgent`, `navigator.language`, `screen.width/height` and the timezone offset (`:22-28`). It encrypts in dev too, which is why tokens in your local localStorage are JWE strings.

## How stores use it, and the cleanup exit on logout

There is exactly one aggregated exit: `useUserStore().logout()` (`stores/modules/user.ts:126-150`) — clear the in-memory state, `cache.removeItem(TOKEN_KEY)` + `cache.removeItem(USER_INFO_KEY)`, `resetPageCache()` (`layouts/composables/usePageCache.ts:59-63`), `useRouteStore().resetRoutes()`, `useTabsStore().reset()`. `forceLogout()` in the request layer does not clean anything itself, it calls this (`composables/web/request/fetcher.ts:72-87`). State that must be cleared on logout gets added here.

| Read / write point | Location |
| --- | --- |
| Stores read the cache while initialising | `user.ts:20-24`, `tabs.ts:23-31,34`, `dict.ts:56` (`loadFromStorage()`) |
| Writes after a change | `user.ts:55,60,106`, `tabs.ts:41-50`, `dict.ts:49`, `packages/preferences/src/store.ts:160-168` (commit persists) |
| Request layer reads tokens as a fallback | `fetcher.ts:96,101,188-190,218` |
| Manual "clear cache and sign out" | `layouts/components/SettingDrawer/components/SettingFooter.vue:45-47`: `cache.clear()` + `localStorage.clear()` + `sessionStorage.clear()` |

::: warning four places along that chain do not line up (read from the code, not guessed)

- **`logout()` never clears `refresh_token`**: `user.ts:129-130` only removes `auth_token` and `user_info`, so the `refresh_token` written at `fetcher.ts:130` stays on disk (only the full wipe in SettingFooter takes it).
- **The login flow never writes `refresh_token`**: the response handled at `user.ts:63-124` only carries `user.token`, so the first `doRefreshToken()` hits `缺少 refresh token` (`fetcher.ts:97`).
- **`userStore.refreshToken` does not exist**: `fetcher.ts:96,190` read it, but the store's return list (`user.ts:163-181`) has no `refreshToken`, so at runtime it is always `undefined` and the value really comes from `cache.getItem`.
- **The second argument of `setToken` is being used as an expiry**: `fetcher.ts:128` passes `newRefresh`, while the signature is `setToken(newToken: string, expire?: number)` (`user.ts:51`); a string fails the `expire && expire > 0` test, so a refreshed token is written **without a TTL**.

Two more "nobody calls it" points: `initToken()` is exported but has no call site (`user.ts:30-40,174`), so after a reload `token.value` holds the pre-`decryptToken` JWE string; `clearDict()` is the same (`dict.ts:131-134`), meaning logout does not clear dictionaries — they rely on the 1-hour `loadedAt` window alone. :::

## Which browser storage is actually used

| Medium | Status |
| --- | --- |
| `localStorage` | The main battlefield: the default cache medium, plus two bare uses (`route.ts:31,43`, `Upload/utils.ts:56,83,91`) |
| `sessionStorage` | **Adapter exists, nobody uses it.** `createStorage('session')` only produces the `sessionStorageAdapter` export at `storage.ts:71`; no `createCache({ type: 'session' })` exists in the app, and the only session operation in app code is the `clear()` in SettingFooter |
| `memory` | `type: 'memory'` appears only in `packages/shared/__tests__/cache.test.ts:137`; the app never uses it |
| IndexedDB | **None.** `indexedDB` has zero hits in source; the only place it shows up is the workbox runtime inside the build output when the PWA is on (`VITE_PWA`, `apps/web/dist/workbox-*.js`), which has nothing to do with app state |

## The cost of invalidation

After you change the prefix (`VITE_APP_TITLE`) or the encryption shape, old cache entries silently become unreadable:

- `deserialize` catches decryption failures and JSON parse failures alike and returns `null` (`index.ts:87-94`), and `getItem` maps `null` to `null` (`:107-109`) — indistinguishable from "nothing cached".
- What the user sees: no token comes back → the guard treats the session as signed out → back to the login page; no preferences come back → `readSaved()`'s `try/catch` yields `undefined` (`packages/preferences/src/store.ts:135-142`) → the UI silently falls back to defaults; no tabs come back → an empty tab bar. Nothing anywhere says "the prefix or the key rejected this".
- **Old keys become orphans**: `clear()` only removes keys whose name starts with the current prefix (`index.ts:136-143`), so after a prefix change the old data can never be cleared through `cache` — only a full `localStorage.clear()` gets rid of it (which is exactly what that SettingFooter button does).
- The same applies across modes: plaintext written in dev cannot be decrypted in a build, and data written under another prefix cannot be decrypted with the new key — `cache.test.ts:106-118` is the spec that pins "decrypting with a different prefix fails and degrades to `null`".
- The token chain has a subtler failure mode: when the device fingerprint changes (browser upgrade, timezone change, screen size / rotation, a different `navigator.language`) the derived key changes, and `decryptToken` returns `null` for a JWE string (`tokenCrypto.ts:106-139`; only legacy plaintext without a `.` falls back). It shows up as "signed out for no reason".

::: tip before you add another piece of persisted state Decide the key first. Application-scoped state follows `dict.ts`: add a `CacheKey` member (and actually reference it), `cache.setItem` inside a `watch`, and add the cleanup to `logout()` in `user.ts`. Purely visual preferences must not open their own key — they belong to `packages/preferences` (see [State management](/en/guide/essentials/stores)). Bare `localStorage` is for data that has nothing to do with cache semantics (menu visibility overrides, upload resume progress), and it must carry its own expiry check. :::

## Related pages

- [State management](/en/guide/essentials/stores) — the six stores and who persists what
- [Utilities](/en/guide/essentials/utils) — which layer `cache` lives in and how it gets reused
- [Configuration](/en/guide/essentials/config) — `VITE_APP_TITLE` / `VITE_CACHE_ENCRYPT_KEY` and the injection chain
- [Core concepts](/en/guide/essentials/concepts) — why packages may not read `import.meta.env`
- [FAQ](/en/guide/other/faq)
