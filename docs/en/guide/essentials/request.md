# Request layer and API contract

The HTTP layer is **a home-grown fetch wrapper**, built on `createFetch` from `@vueuse/core` (`apps/web/src/composables/web/request/fetcher.ts:10,171`). There is no axios dependency anywhere in the repo, and every business request must go through the wrapper functions under `apps/web/src/api/` — don't call `fetch` in pages.

```
views / stores ──► api/*.ts ──► api/request.ts(get/post/put/del)
                                   └─► composables/web/request（fetcher + executor）
                                          └─► VITE_APP_BASE_API（dev: /api → Nitro 5320）
```

## Environment variables

| Variable | dev | prod | Purpose | Source of truth |
| --- | --- | --- | --- | --- |
| `VITE_APP_BASE_API` | `/api` | The real backend address | `baseUrl` of `createFetcher`, defaults to `''` | `apps/web/.env.development:18`, `fetcher.ts:159` |
| `VITE_MOCK` | `true` | `false` | Whether the dev server proxies `/api` to Nitro | `.env.development:19`, `internal/vite-config/src/utils/proxy.ts:40-57` |
| `VITE_MOCK_SERVER` | `http://localhost:5320` | — | The proxy target, the same value as the mock process port | `.env.development:20` |
| `VITE_WS_URL` | Empty | Empty | Notification-center WebSocket; leaving it empty means **don't connect** | `apps/web/src/utils/ws.ts:105-112` |

The timeout defaults to `30_000` ms (`fetcher.ts:160`; per-call override at `executor.ts:176`).

## Outbound: beforeFetch does four things

`fetcher.ts:181-259`:

1. **token**: `useUserStore().token || cache.getItem(TOKEN_KEY)` (`TOKEN_KEY = 'auth_token'`, `config/constants.ts:1,4`), written as `Authorization: Bearer <token>` (`AUTHORIZATION_KEY` is in `composables/constant.ts:1`). Endpoints like login/refresh skip the injection (`isAuthEndpoint`, `fetcher.ts:186`).
2. **Refresh when close to expiry**: when the access token is missing but a refreshToken exists, first get one from `/auth/refresh`; when it exists but has **less than 60s left** (`isTokenExpired(token, 60)`), also refresh first (`fetcher.ts:193-215`, `:93-132`). If refresh fails and no token was ever obtained → `forceLogout()` + throw 401.
3. **CSRF**: only write methods (`STATE_CHANGING`) get an `X-CSRF-Token`; double-submit + automatic rotation (`fetcher.ts:162-169,227-239`).
4. **Security headers**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection`, `Referrer-Policy`; write methods additionally get `Cache-Control: no-store`. For `FormData` the `Content-Type` is **deliberately set to undefined** so the browser adds the boundary itself (`:243-252`).

## Inbound: afterFetch checks the business code

The API contract is an envelope structure; HTTP 200 doesn't mean success (`apps/web/src/api/request.ts:3-16`):

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

- `code !== ErrorCode.SUCCESS(200)` → throws `RequestError` and marks `err.handled = true` to avoid `onFetchError` popping a duplicate message (`fetcher.ts:283-297`). The error-code table is in `request/error.ts:1-12`.
- **Non-JSON responses pass straight through**: when `content-type` doesn't contain `application/json`, the code isn't checked (blob / file download / binary take this path, `fetcher.ts:262-266`).
- Messages are popped uniformly by `reportRequestError` → `notification.error` from `antdv-next`; when the server is down it collapses to "Server busy" rather than showing the user the raw stack (`fetcher.ts:331-334,345-363`).
- **401**: refresh once and replay once (no loop), implemented in `executor.ts:252-275`; `forceLogout` clears the store then jumps via hash to `#/login?redirect=…` (`fetcher.ts:72-87`).

## Retries, cancellation, and component unmount

| Capability | Behavior | Source of truth |
| --- | --- | --- |
| Retry | Exponential backoff + jitter, defaults `retries=3`, `retryDelay=300`, only enabled for retryable errors | `executor.ts:225-246,371`, check at `:137-144` |
| Timeout | The `AbortSignal` is merged with the caller's `signal` and handed to fetch together | `executor.ts:176-183`, `timeout.ts:1-52` |
| Manual cancellation | `useRequest` exposes `abort()` | `composables/web/request/useRequest.ts:65,127-131` |
| Cancel on unmount | Automatically aborts when the effect scope disposes; no need to write it by hand | `useRequest.ts:135` |

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

::: danger The second argument of `get`/`del` **is the query string itself** `request.ts:22-26` hands `params` directly to `buildUrl`. If you write `get(url, { params })`, what goes out is `?params=[object Object]`, and the whole batch of filter and pagination conditions is lost — the symptom is "typing anything into the search box gives the same result, and going to page 2 still shows page 1's data". Only `post`/`put` have a third argument for the query string. :::

The wrapper functions return `res.data`, which is **the whole envelope** (`request.ts:26`), so the caller's `R<T>` still has to take `.data` itself; this layer deliberately does no second-level unwrapping, to accommodate binary and empty-data cases.

## The corresponding mock side

The file path under `apps/backend-mock/server/api/**` is the route: `system/user/list.get.ts` → `GET /api/system/user/list`. Every handler is wrapped in `defineMockRoute({ method, path, handler })`, and responses all go through `success/bizError/httpError` (`server/utils/response.ts:10-34`). See [Mock server (Nitro)](/en/guide/essentials/mock) for details.

- When integrating, **change the mock to align with the backend**; don't write frontend branches compatible with two field conventions.
- The mock account is `admin` / `admin123`, returning a mock token and roles (`server/api/auth/login.post.ts:9-29`).

## WebSocket

The `utils/ws.ts` singleton reads `VITE_WS_URL`, automatically attaches `token` and `type=notice` on connect, and doesn't connect when unset (`:105-112,310`); its only consumer is the notification center `layouts/widgets/WidgetNotice.vue:73`. There's no SSE endpoint on the app side (`packages/composables/src/sse` is a standalone capability package, not wired in).

::: warning Don't bypass the shared client All `api/*.ts` and stores import only `~/api/request` or the http from `~/composables` (e.g. `stores/modules/route.ts:18`, `stores/modules/user.ts:7`). This is currently **a convention, not a lint rule** — ESLint only locks import boundaries (`internal/lint-configs/eslint-config/src/custom-config.ts:31-113`) and doesn't forbid bare `fetch`. Once bypassed, CSRF, 401 refresh, and unified messaging all stop working, and it's hard to catch in code review. :::
