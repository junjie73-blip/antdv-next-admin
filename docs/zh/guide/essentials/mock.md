# Mock 服务（Nitro）

dev 时不需要后端：`pnpm dev:web` 会在 Vite 进程内拉起一个 Nitro 服务，前端 `/api/**` 全部由它应答。

```
apps/web dev server ── 6080
   │  VITE_MOCK=true 时内部插件 `nitroMock()` 启动 nitropack dev server
   └── /api ──proxy──► 127.0.0.1:5320  （apps/backend-mock）
```

- 开关：`.env` 里 `VITE_MOCK`。`.env.development` 设 `true`（走下面的 Nitro 透传）， `.env.production` 也设 `true`，但那是另一套东西 —— 产物里没有 Node 服务，接口由**包内的浏览器mock** 应答，见[生产怎么办](#生产怎么办)。
- 端口是写死的（`VITE_MOCK_SERVER=http://localhost:5320`，proxy 与插件两边各持一份）：插件只做"这个端口能不能用"的探测，不做"帮我找一个空闲端口" —— 换端口没有意义，前端代理地址是按它配的。
- 改 `apps/backend-mock/server/api/**` 会**自动重载**，不用重启 dev。

## 加一条假接口

在 `apps/backend-mock/server/api/` 下按 Nitro 的文件约定新建一个 handler：

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

运行时配置落在 `.mock-state.json`（已 gitignore）。注意**文件名不带路径**：mock 由 `apps/web` 的 dev 进程在进程内拉起，persist 文件落在启动它的 cwd（`apps/web/.mock-state.json`），而不是 `apps/backend-mock/` 下 —— 找"为什么我的开关没保存"时先看这里。

## 上传与真实文件

`server/api/upload.post.ts`（以及 `system/file` 一组）是真接收文件的：分片上传示例页要能真的传上去、图片墙要能预览本地文件，所以这条不能只回一个假 URL。产物里没有 Node 服务时，同一条契约由 `apps/web/src/mock/dynamic.ts` 现造应答（见下）。

## 生产怎么办

生产构建里 `VITE_MOCK=true`，但走的不是 Nitro —— 是 `apps/web/src/mock/` 这套**浏览器内 mock**：产物自己带着数据，部署出去不需要任何后端。

```
main.ts ── activate.ts ──(PROD && VITE_MOCK)──► import('./browser')  // 懒加载，fixtures 不进主 chunk
                                                     └─ 劫持 globalThis.fetch
   请求 ──► matcher.ts（去前缀、同域、method 命中）──► overlay.ts（会话 + 写覆盖层）──► Response
                                        └─ 没命中 / 跨域 ──► 原样透传给真实网络
```

- **数据从哪来**：`scripts/generate-mock-fixtures.mjs`（`pnpm mock:fixtures`）爬一个**正在跑的** Nitro mock，把 67 条接口的响应信封 + 各账号（凭据、权限码、可见菜单白名单）快照成 `src/mock/fixtures.json`（约 420 KB）。mock 接口有增删或结构变化时要重新生成，否则产物里的数据就是上一次抓取时的。
- **没有前缀**：`VITE_APP_BASE_API` 只写在 `.env.development`，生产包里它是空串 —— 请求发到站点根下的 `/menus`、`/auth/login`、`/demo/task/list`。拦截器与请求层读同一个变量，所以两边天然对齐；代码里写死 `/api/...` 会在生产直接漏到网络上。
- **写操作**：抓快照时不碰写接口（抓一次就真改数据，DELETE 尤其致命），所以 POST/PUT/DELETE 的应答由 `overlay.ts` 按同一信封现造，改动落在内存副本上：新增行可检索、`total` 跟着副本走、列表筛选与 Nitro 的 handler 同口径（文本 `includes`、`status` 之类走全等、`page/pageSize` 不参与筛选）。**刷新页面就回到快照** —— 会话与副本都是内存态，这是产物里没有持久化对账对象时的取舍。
- **上传**：multipart 抓不了、返回值又要求每次唯一，所以 `/upload`、`/upload/:variant` 被排除在 fixtures 之外，由 `dynamic.ts` 现造（`fileId` / `storedPath` / 内联 SVG 预览地址），与 Nitro 的 `server/utils/upload.ts` 同一份契约。示例页因此统一走 `customRequest` → 项目的 `http`：antd 默认的上传器用的是 **XHR**，fetch 层的劫持从它旁边绕过去。
- **菜单与权限**：`/menus` 按会话账号的白名单裁剪，前端把裁完的树摊成 allowedNames/allowedPaths，越权页面的路由压根不注册，导航落到通配兜底 → 403。换账号确实换可见范围。

::: warning

`vite preview` 不能用来验生产 `internal/vite-config` 没写 `preview` 段，而 Vite 的 preview server 会**继承 `server.proxy`** ——于是 `/api` 又被 dev 的 Nitro 接住，你看到的"生产能跑"是假阳性。要验就换一个不带代理的静态服务（把 `apps/web/dist` 直接 serve 出去，并且**不要**配 SPA history 兜底：那会把一条没接住的接口伪装成 `200 + index.html`）。仓库里留了 `apps/web/scripts/verify-prod-mock.mjs`：Playwright 打一遍登录 / 菜单 / 增删改查 / 语言切换 / 越权 403 / 上传，并把「逃逸到网络的接口请求」统计成硬失败。
:::

`VITE_MOCK=false` 时开关不成立（`activate.ts:19-22`，dev 下它也成立不了 —— 那时有 Nitro 实时服务，再拦一道会把「数据中心」面板的延迟/停用/生成功能顶掉）。拦截器与 fixtures 因为是 `import()` 进来的独立 chunk，压根不会被加载；接口请求原样透传，`/api` 之类的相对路径由部署平台的转发规则或反代给到真实后端。 `VITE_APP_BASE_API` 是唯一的前缀来源（dev 为 `/api`），代码里不要写死完整域名。

::: warning

别让 mock 变成需求文档 mock 的职责是"让 21 个菜单页面在没有后端时也能点得动"，不是复刻真实业务规则。真接口的字段口径以对接的后端为准；发现 mock 与后端不一致时，**改 mock 去对齐后端**，不要在前端写"两边都兼容"的分支。
:::
