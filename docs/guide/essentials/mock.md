# Mock 服务（Nitro）

dev 时不需要后端：`pnpm dev:web` 通过 Nitro 官方 Vite 插件（`nitro/vite`）在同一个 Vite dev server 上同时服务前端与 `/api/**`。不再有独立的 5320 端口，也不再配置 `/api` 反向代理。

```
apps/web dev server ── 6080
   ├── Vite 负责页面模块与 HMR
   └── nitro/vite 插件负责 /api/** 与 /_ws（源码在 apps/web/backend-mock/server）
```

- 开关：`.env` 里 `VITE_MOCK`。dev 下由插件提供实时接口，生产下则由随包构建的浏览器内 mock 接住（见[生产怎么办](#生产怎么办)）。生产部署后还可以用 `?mock=0/1` 或 `localStorage.BACKEND_MOCK_ENABLED` 现场启停。
- Nitro 配置在 `apps/web/nitro.config.ts`；数据库、KV 与运行时状态落在 `apps/web/.data/` 与 `apps/web/.mock-state.json`。
- 改 `apps/web/backend-mock/server/api/**` 会触发服务端重载，不用手动重启 dev。

## 加一条假接口

在 `apps/web/backend-mock/server/api/` 下按 Nitro 的文件约定新建一个 handler：

```ts
// server/api/system/tag/list.get.ts
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  method: 'GET',
  path: '/system/tag/list',
  handler({ query }) {
    return success(
      { items: [{ id: 1, name: String(query.keyword ?? '') }], total: 1 },
      'ok',
    );
  },
});
```

`defineMockRoute` 的 handler 入参和 legacy mock 对齐：`data`（已解析的请求体，无 body 时是 `{}`）、`params`（`:id` 捕获值）、`query`（**同名多值保持数组**，`login-log` 的 `dateRange` 依赖这个语义，不做拍平）、`body`、`path`（不含 `/api` 前缀与查询串）。

响应统一走 `utils/response.ts` 的信封：`success(data, message)` / `bizError(code, message)`，字段与 `@antdv/types` 里的 Mock 信封一致。

::: tip

路由优先级 legacy 的 fake-server 按注册顺序取首个命中，所以 `withRuntime` 需要手工把"无参数路径"排前面；Nitro 用 radix 树，静态段天然优先于 `:param`，**不再需要重排**。

:::

## 运行时能力：mock-center 管理接口

`defineMockRoute` 会把每条接口登记进 store，于是有一组 `/api/mock-center/*` 管理接口可以在**不重启**的前提下改运行时行为：

| 接口 | 方法 | 用途 |
| --- | --- | --- |
| `/mock-center/overview` | GET | 总览：注册接口数、命中数、平均耗时、被停用/被覆盖的数量、全局配置 |
| `/mock-center/routes` | GET | 路由清单（分组、method、path、当前运行时配置） |
| `/mock-center/runtime` | POST | 改全局配置：`enabled` 总开关、`defaultDelay`、`failRate` |
| `/mock-center/route-runtime` | POST | 改单接口配置：延迟、停用、失败注入 |
| `/mock-center/logs` | GET | 命中日志（`/logs/clear` 清空） |
| `/mock-center/templates` · `/preview` | GET · POST | 模板预设与试跑，用来造数据 |
| `/mock-center/generated` · `/routes/save` | GET · POST | 生成/保存 handler 文件 |

```bash
# 现在有几条接口、被打了多少次
curl -s localhost:6080/api/mock-center/overview

# 让所有接口慢 800ms，看 loading / 骨架屏
curl -s -X POST localhost:6080/api/mock-center/runtime \
  -H 'content-type: application/json' \
  -d '{"defaultDelay":800}'
```

::: warning

面板页目前没有挂在路由上 `apps/web/src/views/tool/mock/**` 只剩私有模块（actions / columns / schemas / types / constants），没有 `index.vue`，也没有别处引用它们；`apps/web/src/api/mock.ts` 是这组接口的客户端。也就是说"数据中心"目前只能通过上面的 HTTP 接口操作，UI 那一层是待恢复的缺口 ——文档先按接口写，等页面回来再补截图。

:::

运行时配置落在 `.mock-state.json`（已 gitignore）。迁入 web 后位置固定在 `apps/web/.mock-state.json` —— 找"为什么我的开关没保存"时先看这里。

## 上传与真实文件

`server/api/upload.post.ts`（以及 `system/file` 一组）是真接收文件的：分片上传示例页要能真的传上去、图片墙要能预览本地文件。dev 下由 Nitro handler 处理 multipart；生产下由 `src/mock/dynamic.ts` 按同一信封契约现造应答（multipart 无法快照，且 `fileId` / 预览地址要求每次唯一）。

## 生产怎么办

生产包把 mock 服务的响应**快照**直接编进 `apps/web/src/mock/fixtures.json`，在 fetch 出口拦截同源 `/api/*`：没有 Nitro 服务端、没有云函数、没有反代配置。任意静态托管（Vercel / Netlify / Nginx / OSS）都只需要上传 `apps/web/dist`。官方 `nitro/vite` 插件在 `vite.config.ts` 里用 `apply: 'serve'` 限定为开发期，因此 `vite build` 仍只产出静态包。

```
开发环境：web dev 6080 ──nitro/vite 插件（同进程）──► /api/**、/_ws
生产环境：同源 /api/* ──► globalThis.fetch 拦截器 ──► fixtures 快照 + 内存覆盖层
          未命中 / 跨域 / 真实业务接口 ──► 原生 fetch（原样透传）
```

- 快照怎么来：`pnpm mock:fixtures`。脚本以 `apps/web` 为 rootDir 起进程内 Nitro，扫 `apps/web/backend-mock/server/api` 下全部路由，用内存库抓取 GET 的统一信封响应、账号表与菜单；**接口有增删或响应结构变化时重跑一次**。产物入库，CI / 离线构建不需要 mock 服务在跑。
- 写操作：`POST/PUT/DELETE` 不抓快照（抓一次就真改数据），由 `overlay.ts` 在内存副本上现造；新增行可检索、`total` 跟着变，刷新页面回到快照。
- 启停开关：构建期由 `.env.production` 的 `VITE_MOCK=true` 决定；部署后可用 URL `?mock=0` / `?mock=1` 或 `localStorage.BACKEND_MOCK_ENABLED` 现场覆盖，不必重新构建。dev 下不装拦截器（实时 mock 由官方 Nitro 插件提供），除非显式用运行时开关强开。
- 隔离：只拦同源且以 `VITE_APP_BASE_API`（缺省 `/api`）开头的请求。路由表里没有的路径、真实业务接口、跨域请求、静态资源与 HEAD/OPTIONS 一律原样透传。
- 上传：`dynamic.ts` 现造 `{ variant, fileId, url, storedPath, uploadedAt }`，契约镜像 `apps/web/backend-mock/server/utils/upload.ts`，`fileId` 与预览地址每次唯一。

::: warning

`vite preview` 不能用来验生产：它仍会加载 `vite.config`，官方 Nitro 插件虽已限定 `apply: 'serve'`，但仓库自己的验证脚本会显式用无代理静态服务，避免任何服务端参与造成假阳性。先跑 `pnpm verify:environments`：进程内起 Nitro，把开发态响应与生产包快照逐条对比状态码、业务码、文案与结构，报告落在 `.tmp/verify-environments-report.json`。再跑 `pnpm --filter @antdv/web verify:mock`：自带一个没有代理的静态服务，用 Playwright 打一遍登录 / 菜单 / 增删改查，并把逃逸到网络的接口请求记为硬失败。

:::

::: warning

别让 mock 变成需求文档 mock 的职责是"让所有菜单页面在没有后端时也能点得动"，不是复刻真实业务规则。真接口的字段口径以对接的后端为准；发现 mock 与后端不一致时，**改 mock 去对齐后端**，不要在前端写"两边都兼容"的分支。

:::
