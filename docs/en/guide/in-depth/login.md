# Login

In one sentence: **username + password go through `userStore.login()`, the token is encrypted into cache, then the app jumps to `redirect` or the home constant; logout must clear all four pieces of session state in one pass.**

The page lives in `apps/web/src/views/login/index.vue`, the state in `apps/web/src/stores/modules/user.ts`, the interception in the router guards (see [Access control](/en/guide/in-depth/access)), and credential injection in the request layer (see [HTTP requests](/en/guide/essentials/request)). This page covers the chain itself.

## The full login flow

```
Form validation (antd form rules)
  → userStore.login(username, password)
  → http.Post('/auth/login')            // fetcher's beforeFetch exempts auth endpoints: no Bearer
  → code === 200
      ├── setToken(token)               // encryptToken (AES-256-GCM) into cache['auth_token'], 24h expiry
      └── setUserInfo(info)             // roles / permissions into cache['user_info']
  → router.push(route.query.redirect || HOME_PATH)   // HOME_PATH = '/dashboard/analysis'
```

Pitfalls that are baked into the code with reasons:

- **Never hardcode `/dashboard` as the post-login target.** It is a menu directory node with no page component of its own — jumping there gives "chrome everywhere, blank content area". The guard has a safety net too: `resolveDirectory` maps a directory to its first visible leaf (`router/guards/index.ts`).
- **The demo account is `admin / admin123`.** The mock endpoint hardcodes the check in `apps/backend-mock/server/api/auth/login.post.ts` and returns `mock_token_<timestamp>`; the hint is also shown under the form.
- **The mobile-login tab is not wired to the backend.** `handleLogin` calls `userStore.login(username, password)` regardless of mode, and "send code" only shows a message; the `remember` checkbox is never consumed either. All three need real endpoints when you connect an actual backend.
- If encryption fails, the token is **stored in plaintext** with a `console.warn` (the try/catch inside `setToken`) — a crypto hiccup never locks a user out.

## How the guards intercept

The wiring is in `apps/web/src/router/guards/index.ts`; it only injects dependencies, while all logic sits in `applyRouterGuards` from `@antdv/router` (execution order is registration order):

| Stage | Config | Notes |
| --- | --- | --- |
| progress | NProgress | Registered first so later redirects still show "loading" |
| auth | `whiteList` | `WHITE_LIST = ['/login', '/register', '/error/*']` (`config/constants.ts`); anonymous users go to `/login?redirect=<current hash path>` |
| dynamicRoutes | `loadRoutes` | Once logged in and not yet loaded, `routeStore.initRoutes()` fetches `/menus` and prunes the route table — "the menu is the permission" |
| title | `VITE_APP_TITLE` | afterEach writes the document title |

## 401s, token refresh, and forceLogout

Rules implemented in the request layer (`packages/request/src/fetcher.ts` + `executor.ts`):

1. `beforeFetch` attaches `Bearer` to non-auth endpoints; with no token it tries a refresh first if a refresh token exists, otherwise `forceLogout()`.
2. On a 401, `doOnceWithAuthReplay` **refreshes once and replays once**; auth endpoints themselves, an in-flight logout, or an already-replayed request throw directly to avoid loops.
3. `forceLogout` does exactly two things: call `useUserStore().logout()` (the single exit) and **change the hash** to `#/login?redirect=…`. The app uses `createWebHashHistory`, so assigning `location.href = '/login'` triggers a full page reload, aborts the pending navigation, and drops the redirect parameter.

::: warning The mock backend has no `/auth/refresh` `backend-mock/server/api/auth/` contains only `login` / `logout` / `user-info`, and the login response issues no refresh token. So in the demo environment a 401 simply ends in `forceLogout`. The refresh path is designed around `REFRESH_TOKEN_KEY` (`config/constants.ts`) and only becomes live against a real backend. :::

::: tip Token decryption is opt-in Store initialization reads the ciphertext from cache as-is; `initToken()` decrypts it asynchronously (falling back to the raw value when decryption fails, for legacy plaintext). It is not on the bootstrap path, so when you touch this chain verify that after a page refresh the `Authorization` header carries a usable token. :::

## The four things logout must clear

Nothing in `userStore.logout()` (`stores/modules/user.ts`) may be skipped, or "switching accounts inside the same page session" leaks the previous user's state:

| What gets cleared | What leaks without it |
| --- | --- |
| `token` + cache `auth_token` | Still considered logged in |
| `userInfo` + cache `user_info` | Avatar / nickname / roles belong to the previous user |
| `resetPageCache()` | KeepAlive still holds the previous user's component instances |
| `routeStore.resetRoutes()` + `tabsStore.reset()` | `isLoaded` stays true, so the guard skips `loadRoutes()` — the menu and the access sets remain the previous account's, and stale tabs point at pages the new account may not open |
