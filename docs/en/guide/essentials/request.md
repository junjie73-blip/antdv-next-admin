# Request layer and API contract

The HTTP layer is **a home-grown fetch wrapper**, now its own package `@antdv/request` (`packages/request/`), built on `createFetch` from `@vueuse/core` (`packages/request/src/fetcher.ts:10,160`). There is no axios dependency anywhere in the repo, and every business request must go through the wrapper functions under `apps/web/src/api/` — don't call `fetch` in pages.

```
views / stores ──► api/*.ts ──► api/request.ts(get/post/put/del)
                                   └─► @antdv/request (fetcher + executor)
                                          └─► baseUrl injected by the app entry (dev: /api → Nitro 5320)
```

## The package knows nothing about the app: the configureRequest seam

`@antdv/request` only understands HTTP. Three things it cannot know, so the application injects them at the entry point (`packages/request/src/runtime.ts:20-64`):

| Injected | Meaning | Implemented in |
| --- | --- | --- |
| `baseUrl` / `timeout` | Endpoint prefix and default timeout | `apps/web/src/plugins/request-runtime.ts` |
| `tokens` | Read/write the access / refresh credentials (`access` / `refresh` / `setAccess` / `setRefresh`) | Same file, over `useUserStore()` and `cache` |
| `loginPath` | Where to go once the session is gone (`/login` under hash routing) | `LOGIN_PATH` in `apps/web/src/config/constants.ts` |
| `onLogout` | Which state to clear when the session ends | `useUserStore().logout()` |

::: warning

The injection has to happen before the first request, and only from the application entry calling `configureRequestRuntime()`. Running a request without it throws straight away (`getRequestRuntime()`, `runtime.ts:48-56`) — it never silently sends a request with empty credentials. This file pulls `~/stores` into the module graph, so `test/setup.ts` must not touch it (same for `table-runtime.ts` and `layouts-host.ts`): setup runs before the `vi.mock` calls in a spec, and a module it has imported can no longer be replaced. That is why the specs in `apps/web/src/plugins/__tests__/` mock nothing — they inject, then read the runtime back from the package. `ui-runtime.ts` is the only one setup does call, because it injects copy and nothing else. :::

## The data-fetching client: `@antdv/request/vue-query`

The `QueryClient` and its installer live in the request package too (`packages/request/src/vue-query.ts`): the entry calls `setupVueQuery(app)` (`apps/web/src/main.ts:71`) and pages must not `new QueryClient()` themselves. The default policy pins three things — `retry: false` (transport retries belong to the executor's `withRetry` + 401 replay; two layers stacking would multiply the request volume), `refetchOnWindowFocus: false`, `staleTime: 30_000` — and `packages/request/__tests__/vue-query.spec.ts` keeps that honest.

It is a **subpath export** and stays out of the root barrel, the same way `./sse` and `./websocket` do: a page that only wants `requestClient` should not drag all of vue-query into its module graph.

## Environment variables

| Variable | dev | prod | Purpose | Source of truth |
| --- | --- | --- | --- | --- |
| `VITE_APP_BASE_API` | `/api` | `/api` (the built bundle carries the same value) | The `baseUrl` handed to `createFetcher`, defaults to `''` | `apps/web/.env.development:19`, `apps/web/.env.production:12`, `apps/web/src/plugins/request-runtime.ts:16`, `fetcher.ts:162` |
| `VITE_MOCK` | `true` | `true` | In dev the dev server proxies `/api` to Nitro; in prod the fixtures bundled into the artifact intercept same-origin requests at the fetch exit, so no Node mock service is needed | `.env.development:18`, `.env.production:7-10`, `internal/vite-config/src/utils/proxy.ts:40-57` |
| `VITE_MOCK_SERVER` | `http://localhost:5320` | — | The proxy target, the same value as the mock process port | `.env.development:20` |
| `VITE_WS_URL` | Empty | Empty | Notification-center WebSocket; leaving it empty means **don't connect** | `apps/web/src/utils/ws.ts:107-112` |

The timeout defaults to `30_000` ms (`fetcher.ts:163`; per-call override at `executor.ts:177`).

## Outbound: beforeFetch does four things

`fetcher.ts:185-262`:

1. **token**: credentials come only from the injected `tokens.access()` (`fetcher.ts:190-193`), written as `Authorization: Bearer <token>` (`AUTHORIZATION_KEY` is now in `fetcher.ts:16`). Endpoints like login/refresh skip the injection (`isAuthEndpoint`, `fetcher.ts:35`, used at `:187`). **Never fall back to the cache**: what storage holds is a JWE ciphertext, and sending it as a credential means a 401 on every reload.
2. **Refresh when close to expiry**: when the access token is missing but a refreshToken exists, first get one from `/auth/refresh`; when it exists but has **less than 60s left** (`isTokenExpired(token, 60)`), also refresh first (`fetcher.ts:196-220`, refresh implementation `:94-134`). If refresh fails and no token was ever obtained → `forceLogout()` + throw 401.
3. **CSRF**: only write methods (`STATE_CHANGING`) get an `X-CSRF-Token`; double-submit + automatic rotation (`fetcher.ts:165-172,231-243`).
4. **Security headers**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection`, `Referrer-Policy`; write methods additionally get `Cache-Control: no-store`. For `FormData` the `Content-Type` is **deliberately set to undefined** so the browser adds the boundary itself (`:245-259`).

## Inbound: afterFetch checks the business code

The API contract is an envelope structure; HTTP 200 doesn't mean success (`apps/web/src/api/request.ts:5-18`):

```ts
interface R<T> {
  code: number;
  data: T;
  message: string;
}
interface RL<T> {
  code: number;
  data: { list: T[]; total: number };
  message: string;
}
```

- `code !== ErrorCode.SUCCESS(200)` → throws `RequestError` and marks `err.handled = true` to avoid `onFetchError` popping a duplicate message (`fetcher.ts:287-298`). The error-code table is in `packages/request/src/error.ts`.
- **Non-JSON responses pass straight through**: when `content-type` doesn't contain `application/json`, the code isn't checked (blob / file download / binary take this path, `fetcher.ts:268`).
- Messages are popped uniformly by `reportRequestError` → `toast.error` from `@antdv/popup-ui`; when the server is down it collapses to "Server busy" rather than showing the user the raw stack (`fetcher.ts:349-365`). `401` sits in `SILENT_CODES`, so it stays quiet (`:29`).
- **401**: refresh once and replay once (no loop), implemented in `executor.ts:253-276`; `forceLogout` calls `onLogout` to clear the store then jumps via hash to `#/login?redirect=…` (`fetcher.ts:73-88`), and a repeat call within 5 seconds is swallowed by the latch (`:74`).

## Retries, cancellation, and component unmount

| Capability | Behavior | Source of truth |
| --- | --- | --- |
| Retry | Exponential backoff + jitter, defaults `retries=3`, `retryDelay=300`, only enabled for retryable errors | `executor.ts:226-247,374`, check at `:138-145` |
| Timeout | The `AbortSignal` is merged with the caller's `signal` and handed to fetch together | `executor.ts:177-183`, `timeout.ts:1-58` |
| Manual cancellation | `useRequest` exposes `abort()` | `packages/request/src/useRequest.ts:147-151` |
| Cancel on unmount | Automatically aborts when the effect scope disposes; no need to write it by hand | `useRequest.ts:155` |

## How to write an api module

`apps/web/src/api/` has one file per domain: `index.ts` (auth), `menu.ts`, `system.ts`, `security.ts`, `screen.ts`, `mock.ts`. Naming uses verb phrases (`getXxxList` / `addXxx` / `updateUser` / `deleteUser`), and the return value describes the envelope's `data` via the generic argument:

```ts
// apps/web/src/api/system.ts:1-33
import { del, get, post, put } from './request';

/** User list pagination */
export function getUserList(params?: Record<string, unknown>) {
  return get<{ list: any[]; total: number }>('/system/user/list', params);
}

/** Edit a user */
export function updateUser(id: number, data: Record<string, unknown>) {
  return put<any>(`/system/user/${id}`, data);
}
```

::: danger

The second argument of `get`/`del` **is the query string itself** `request.ts:22-26` hands `params` directly to `buildUrl`. If you write `get(url, { params })`, what goes out is `?params=[object Object]`, and the whole batch of filter and pagination conditions is lost — the symptom is "typing anything into the search box gives the same result, and going to page 2 still shows page 1's data". Only `post`/`put` have a third argument for the query string. :::

The wrapper functions return `res.data`, which is **the whole envelope** (`request.ts:29`), so the caller's `R<T>` still has to take `.data` itself; this layer deliberately does no second-level unwrapping, to accommodate binary and empty-data cases.

## The corresponding mock side

The file path under `apps/backend-mock/server/api/**` is the route: `system/user/list.get.ts` → `GET /api/system/user/list`. Every handler is wrapped in `defineMockRoute({ method, path, handler })`, and responses all go through `success/bizError/httpError` (`server/utils/response.ts:10-34`). See [Mock server (Nitro)](/en/guide/essentials/mock) for details.

- When integrating, **change the mock to align with the backend**; don't write frontend branches compatible with two field conventions.
- The mock account is `admin` / `admin123`, returning a mock token and roles (`server/api/auth/login.post.ts:9-29`).

## WebSocket

The singleton in `apps/web/src/utils/ws.ts` reads `VITE_WS_URL` and attaches `token` plus `type=notice` when it connects (`resolveWsUrl`, `:107-112`); if the variable is missing it never starts a connection at all (`:312-319`). There is exactly one consumer chain: `apps/web/src/plugins/layouts-host.ts:22` takes `onNotice` and injects it through `configureLayoutHost({ notice: { onPush } })` (`:40-48`), and `packages/layouts/src/widgets/notification/index.vue:84` subscribes to it. `apps/web/src/composables/useNotice.ts:74` also calls `useWebSocket()`, but `useNotice()` itself has no call sites in the repo — that one is dead code. There is no SSE endpoint on the app side either (`@antdv/request/sse` is only exercised by `packages/request/__tests__/sse.spec.ts`).

::: warning

Don't bypass the shared client The app's `api/*.ts` go only through `~/api/request` (which re-exports the `http` from `~/composables` under envelope types); `packages/stores` never references app paths at all and imports the `http` from `@antdv/request` directly (e.g. `packages/stores/src/route.ts:8`, `packages/stores/src/user.ts:6`). This is currently **a convention, not a lint rule** — ESLint only locks import boundaries (`internal/lint-configs/eslint-config/src/custom-config.ts:31-113`) and doesn't forbid bare `fetch`. Once bypassed, CSRF, 401 refresh, and unified messaging all stop working, and it's hard to catch in code review. :::
