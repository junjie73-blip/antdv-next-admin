# 请求层与接口约定

HTTP 层是**自研的 fetch 封装**，独立成 `@antdv/request`（`packages/request/`），建立在 `@vueuse/core` 的 `createFetch` 上（`packages/request/src/fetcher.ts:10,160`）。全仓没有 axios 依赖，所有业务请求都必须走 `apps/web/src/api/` 下的封装函数，不要在页面里 `fetch`。

```
views / stores ──► api/*.ts ──► api/request.ts(get/post/put/del)
                                   └─► @antdv/request（fetcher + executor）
                                          └─► baseUrl 由应用入口注入（dev: /api → Nitro 5320）
```

## 包不认应用：configureRequest 注入点

`@antdv/request` 只懂 HTTP，三件事它一概不知道，必须由应用在入口注入（`packages/request/src/runtime.ts:20-64`）：

| 注入项 | 含义 | 应用侧实现在 |
| --- | --- | --- |
| `baseUrl` / `timeout` | 接口前缀与默认超时 | `apps/web/src/plugins/request-runtime.ts` |
| `tokens` | 读写 access / refresh 凭证（`access` / `refresh` / `setAccess` / `setRefresh`） | 同上，走 `useUserStore()` 与 `cache` |
| `loginPath` | 会话失效后回哪个页面（hash 路由下是 `/login`） | `apps/web/src/config/constants.ts` 的 `LOGIN_PATH` |
| `onLogout` | 会话没了要清哪些状态 | `useUserStore().logout()` |

::: warning 注入必须赶在第一发请求之前，而且只能在应用入口调 `configureRequestRuntime()`。没注入就跑请求会直接抛错（`getRequestRuntime()`，`runtime.ts:48-56`），不会静默用空凭证发请求。这个文件会把 `~/stores` 拖进模块图，和 `table-runtime.ts`、`ui-runtime.ts` 同一个约束：**测试 setup 不能碰**，否则别人的 `vi.mock` 失效。:::

## 环境变量

| 变量 | dev | prod | 作用 | 事实来源 |
| --- | --- | --- | --- | --- |
| `VITE_APP_BASE_API` | `/api` | 真实后端地址 | 注入给 `createFetcher` 的 `baseUrl`，缺省 `''` | `apps/web/.env.development:18`、`apps/web/src/plugins/request-runtime.ts:16`、`fetcher.ts:162` |
| `VITE_MOCK` | `true` | `false` | 是否让 dev server 把 `/api` 代理给 Nitro | `.env.development:19`、`internal/vite-config/src/utils/proxy.ts:40-57` |
| `VITE_MOCK_SERVER` | `http://localhost:5320` | — | 代理目标，与 mock 进程端口是同一个值 | `.env.development:20` |
| `VITE_WS_URL` | 空 | 空 | 通知中心 WebSocket；留空即**不连** | `apps/web/src/utils/ws.ts:105-112` |

超时默认 `30_000` ms（`fetcher.ts:163`，单次调用可在 `executor.ts:177` 覆盖）。

## 出站：beforeFetch 干了四件事

`fetcher.ts:185-262`：

1. **token**：凭证只从注入的 `tokens.access()` 取（`fetcher.ts:190-193`），写成 `Authorization: Bearer <token>`（`AUTHORIZATION_KEY` 在 `fetcher.ts:16`）。登录/刷新这类端点跳过注入（`isAuthEndpoint`，`fetcher.ts:35`、用在 `:187`）。**不要回退去读缓存**：缓存里是 JWE 密文，当凭证发出去每次刷新都 401。
2. **临期先刷新**：access token 缺失但存在 refreshToken 时先 `/auth/refresh` 拿一张；存在但**剩余不足 60s**（`isTokenExpired(token, 60)`）也先刷新（`fetcher.ts:196-220`，刷新实现 `:94-134`）。刷新失败且从未拿到 token → `forceLogout()` + 抛 401。
3. **CSRF**：只对写方法（`STATE_CHANGING`）附 `X-CSRF-Token`，双提交 + 自动轮换（`fetcher.ts:165-172,231-243`）。
4. **安全头**：`X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`、 `X-XSS-Protection`、`Referrer-Policy`；写方法再加 `Cache-Control: no-store`。 `FormData` 时**故意把 `Content-Type` 置 undefined**，让浏览器自己带 boundary（`:245-259`）。

## 入站：afterFetch 判业务码

接口约定是信封结构，HTTP 200 不代表成功（`apps/web/src/api/request.ts:3-16`）：

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

- `code !== ErrorCode.SUCCESS(200)` → 抛 `RequestError`，并标记 `err.handled = true` 避免 `onFetchError` 重复弹提示（`fetcher.ts:287-298`）。错误码表在 `packages/request/src/error.ts`。
- **非 JSON 响应直接透传**：`content-type` 不含 `application/json` 时不看 code（blob / 文件下载 / 二进制走这条路，`fetcher.ts:268`）。
- 提示统一由 `reportRequestError` → `@antdv/popup-ui` 的 `toast.error` 弹出；服务端挂掉时收敛成"服务器繁忙"，不把原始堆栈给用户（`fetcher.ts:349-365`）。`401` 在 `SILENT_CODES` 里，不弹提示（`:29`）。
- **401**：刷新一次并重放一次（不循环），实现见 `executor.ts:253-276`； `forceLogout` 调 `onLogout` 清 store 后走 hash 跳 `#/login?redirect=…`（`fetcher.ts:73-88`），5 秒内的重复调用被门闩吃掉（`:74`）。

## 重试、取消、组件卸载

| 能力 | 行为 | 事实来源 |
| --- | --- | --- |
| 重试 | 指数退避 + 抖动，默认 `retries=3`、`retryDelay=300`，只对可重试错误开 | `executor.ts:226-247,374`、判定 `:138-145` |
| 超时 | `AbortSignal` 与调用方 `signal` 合并后一起交给 fetch | `executor.ts:177-183`、`timeout.ts:1-58` |
| 主动取消 | `useRequest` 暴露 `abort()` | `packages/request/src/useRequest.ts:147-151` |
| 卸载即取消 | effect scope dispose 时自动 abort，不必手写 | `useRequest.ts:155` |

## api 模块怎么写

`apps/web/src/api/` 一个域一个文件：`index.ts`(auth)、`menu.ts`、`system.ts`、`security.ts`、 `screen.ts`、`mock.ts`。命名成动词短语（`getXxxList` / `addXxx` / `updateUser` / `deleteUser`），返回值靠泛型参数描述信封里的 `data`：

```ts
// apps/web/src/api/system.ts:1-33
import { del, get, post, put } from './request';

/** 用户列表分页 */
export function getUserList(params?: Record<string, unknown>) {
  return get<{ list: any[]; total: number }>('/system/user/list', params);
}

/** 编辑用户 */
export function updateUser(id: number, data: Record<string, unknown>) {
  return put<any>(`/system/user/${id}`, data);
}
```

::: danger `get`/`del` 的第二个实参**就是查询串本身** `request.ts:22-26` 把 `params` 直接交给 `buildUrl`。如果你写成 `get(url, { params })`，发出去的是 `?params=[object Object]`，筛选和分页条件整批丢失——表现是"搜索框输什么都一样、翻到第二页还是第一页的数据"。`post`/`put` 才有第三个参数用于查询串。:::

封装函数返回的是 `res.data`，也就是**整个信封**（`request.ts:26`），所以调用方拿到的 `R<T>` 还要自己取 `.data`；这一层刻意不做二次解包，方便二进制与空 data 的场景。

## Mock 侧的对应关系

`apps/backend-mock/server/api/**` 的文件路径就是路由：`system/user/list.get.ts` → `GET /api/system/user/list`。每个 handler 用 `defineMockRoute({ method, path, handler })` 包一层，响应统一走 `success/bizError/httpError`（`server/utils/response.ts:10-34`）。详见[Mock 服务（Nitro）](/guide/essentials/mock)。

- 联调时**改 mock 去对齐后端**，不要在前端写兼容两种字段口径的分支。
- mock 账号 `admin` / `admin123`，返回 mock token 与 roles（`server/api/auth/login.post.ts:9-29`）。

## WebSocket

`utils/ws.ts` 的单例读 `VITE_WS_URL`，连接时自动附 `token` 与 `type=notice`，未配置就不连（`:105-112,310`）；消费方只有通知中心 `layouts/widgets/WidgetNotice.vue:73`。应用侧没有 SSE 端点（`packages/request/src/sse` 是独立能力包，未接入）。

::: warning 不要绕过共享 client 所有 `api/*.ts` 与 store 只 import `~/api/request` 或 `~/composables` 的 http（例如 `stores/modules/route.ts:18`、`stores/modules/user.ts:7`）。这条目前是**约定而不是 lint 规则**——ESLint 只锁 import 边界（`internal/lint-configs/eslint-config/src/custom-config.ts:31-113`），不禁止裸 `fetch`。绕过之后 CSRF、401 刷新、统一提示全部失效，而且很难在 code review 里发现。:::
