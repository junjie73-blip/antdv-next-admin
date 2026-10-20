# Login

In one sentence: **username + password go through `userStore.login()`, the token is encrypted into cache, then the app jumps to `redirect` or the home constant; logout must clear all four pieces of session state in one pass.**

The page lives in `apps/web/src/views/login/index.vue`, the state in `packages/stores/src/user.ts` (see `logout` at :164-170), the interception in the router guards (see [Access control](/en/guide/in-depth/access)), and credential injection in the request layer (see [HTTP requests](/en/guide/essentials/request)). This page covers the chain itself.

## The full login flow

```
Form validation (@antdv/form-ui Rule / runRule)
  → userStore.login(username, password)
  → http.Post('/auth/login')            // fetcher's beforeFetch exempts auth endpoints: no Bearer
  → code === 200
      ├── setToken(token)               // encryptToken (AES-256-GCM) into cache['auth_token'], 24h expiry
      └── setUserInfo(info)             // roles / permissions into cache['user_info']
  → router.push(route.query.redirect || HOME_PATH)   // HOME_PATH = '/dashboard/analysis'
```

The login page no longer uses antd Form: `index.vue:7` imports `Rule` from `@antdv/form-ui` and :18 imports `runRule`, field rules are declared at :85-116 and run one-by-one at :127-148; the engine lives in `packages/core/ui-kit/form-ui/src/rule-registry.ts`. The toast also comes from `@antdv/popup-ui`'s `message` (`index.vue:23`) — unrelated to antd's `message`.

Pitfalls that are baked into the code with reasons:

- **Never hardcode `/dashboard` as the post-login target.** It is a menu directory node with no page component of its own — jumping there gives "chrome everywhere, blank content area". The guard has a safety net too: `resolveDirectory` maps a directory to its first visible leaf (`router/guards/index.ts`).
- **The demo account is `admin / admin123`.** The account table lives in `apps/backend-mock/server/utils/accounts.ts` (both `authenticate` and `issueToken` come from there); tokens look like `mock_token_<username>_<timestamp>`, and the hint is shown under the form.
- **The mobile-login tab is not wired to the backend.** `handleLogin` calls `userStore.login(username, password)` regardless of mode, and "send code" only shows a message; the `remember` checkbox is never consumed either. All three need real endpoints when you connect an actual backend.
- If encryption fails, the token is **stored in plaintext** with a `console.warn` (the try/catch that wraps the `setToken` call inside `login()`, `user.ts:135-145`) — a crypto hiccup never locks a user out. Note that `setToken` itself (`user.ts:56-61`) has no fallback branch: it just lets the failure propagate, and the plaintext recovery lives in `login()`.

## How the guards intercept

The wiring is in `apps/web/src/router/guards/index.ts`; it only injects dependencies, while all logic sits in `applyRouterGuards` from `@antdv/router` (execution order is registration order):

| Stage | Config | Notes |
| --- | --- | --- |
| progress | NProgress | Registered first so later redirects still show "loading" |
| auth | `whiteList` | `WHITE_LIST = ['/login', '/register', '/error/404', '/error/403', '/error/503']` (`apps/web/src/config/constants.ts:6-12`; the list is explicit paths, not an `/error/*` glob); anonymous users go to `/login?redirect=<current hash path>` |
| dynamicRoutes | `loadRoutes` | Once logged in and not yet loaded, `routeStore.initRoutes()` fetches `/menus` and prunes the route table — "the menu is the permission" |
| title | `VITE_APP_TITLE` | afterEach writes the document title |

## 401s, token refresh, and forceLogout

Rules implemented in the request layer (`packages/request/src/fetcher.ts` + `executor.ts`):

1. `beforeFetch` attaches `Bearer` to non-auth endpoints; with no token it tries a refresh first if a refresh token exists, otherwise `forceLogout()`.
2. On a 401, `doOnceWithAuthReplay` **refreshes once and replays once**; auth endpoints themselves, an in-flight logout, or an already-replayed request throw directly to avoid loops.
3. `forceLogout` (`packages/request/src/fetcher.ts:73-88`) does exactly two things: call the injected `onLogout()` — the app wires it to `useUserStore().logout()` in `plugins/request-runtime.ts` (the single exit) — and **change the hash** to `#/login?redirect=…`. The app uses `createWebHashHistory`, so assigning `location.href = '/login'` triggers a full page reload, aborts the pending navigation, and drops the redirect parameter.

::: warning

The mock backend has no `/auth/refresh` `backend-mock/server/api/auth/` contains only `login` / `logout` / `user-info`, and the login response issues no refresh token. So in the demo environment a 401 simply ends in `forceLogout`. The refresh path is designed around `REFRESH_TOKEN_KEY` (`config/constants.ts`) and only becomes live against a real backend.
:::

::: tip

Token decryption is opt-in Store initialization only reads the ciphertext from cache as-is into `token` (`user.ts:19-20`); `initToken()` decrypts it asynchronously, falling back to the raw value when decryption fails (for legacy plaintext) (`user.ts:36-45`). It IS on the bootstrap path — `bootstrap()` in `main.ts` runs `await useUserStore().initToken()` before installing the router and mounting (`main.ts:167-171`), and it must happen before the first navigation, otherwise the guard still holds ciphertext and the `Authorization` header 401s.
:::

## The four things logout must clear

Nothing in `userStore.logout()` (`packages/stores/src/user.ts:164-170`) may be skipped, or "switching accounts inside the same page session" leaks the previous user's state:

| What gets cleared | What leaks without it |
| --- | --- |
| `token` + cache `auth_token` | Still considered logged in |
| `userInfo` + cache `user_info` | Avatar / nickname / roles belong to the previous user |
| `resetPageCache()` | KeepAlive still holds the previous user's component instances |
| `routeStore.resetRoutes()` + `tabsStore.reset()` | `isLoaded` stays true, so the guard skips `loadRoutes()` — the menu and the access sets remain the previous account's, and stale tabs point at pages the new account may not open |
