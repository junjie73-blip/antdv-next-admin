# Mock 服务（Nitro）

dev 时不需要后端：`pnpm dev:web` 会在 Vite 进程内拉起一个 Nitro 服务，前端 `/api/**` 全部由它应答。

```
apps/web dev server ── 6080
   │  VITE_MOCK=true 时内部插件 `nitroMock()` 启动 nitropack dev server
   └── /api ──proxy──► 127.0.0.1:5320  （apps/backend-mock）
```

- 开关：`.env` 里 `VITE_MOCK`。`.env.development` 设 `true`，`.env.production` 设 `false`，
  生产包里**不会**带 mock 代码。
- 端口是写死的（`VITE_MOCK_SERVER=http://localhost:5320`，proxy 与插件两边各持一份）：
  插件只做"这个端口能不能用"的探测，不做"帮我找一个空闲端口" —— 换端口没有意义，前端
  代理地址是按它配的。
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

`defineMockRoute` 的 handler 入参和 legacy mock 对齐：`data`（已解析的请求体，无 body 时是
`{}`）、`params`（`:id` 捕获值）、`query`（**同名多值保持数组**，`login-log` 的 `dateRange`
依赖这个语义，不做拍平）、`body`、`path`（不含 `/api` 前缀与查询串）。

响应统一走 `utils/response.ts` 的信封：`success(data, message)` / `bizError(code, message)`，
字段与 `@antdv/types` 里的 Mock 信封一致。

::: tip 路由优先级
legacy 的 fake-server 按注册顺序取首个命中，所以 `withRuntime` 需要手工把"无参数路径"排前面；
Nitro 用 radix 树，静态段天然优先于 `:param`，**不再需要重排**。
:::

## 运行时能力：mock-center 管理接口

`defineMockRoute` 会把每条接口登记进 store，于是有一组 `/api/mock-center/*` 管理接口可以
在**不重启**的前提下改运行时行为：

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

::: warning 面板页目前没有挂在路由上
`apps/web/src/views/tool/mock/**` 只剩私有模块（actions / columns / schemas / types / constants），
没有 `index.vue`，也没有别处引用它们；`apps/web/src/api/mock.ts` 是这组接口的客户端。
也就是说"数据中心"目前只能通过上面的 HTTP 接口操作，UI 那一层是待恢复的缺口 ——
文档先按接口写，等页面回来再补截图。
:::

运行时配置落在 `.mock-state.json`（已 gitignore）。注意**文件名不带路径**：mock 由 `apps/web`
的 dev 进程在进程内拉起，persist 文件落在启动它的 cwd（`apps/web/.mock-state.json`），
而不是 `apps/backend-mock/` 下 —— 找"为什么我的开关没保存"时先看这里。


## 上传与真实文件

`server/api/upload.post.ts`（以及 `system/file` 一组）是真接收文件的：分片上传示例页要能真的传上去、
图片墙要能预览本地文件，所以这条不能只回一个假 URL。

## 生产怎么办

生产构建里 `VITE_MOCK=false`，`/api` 由部署平台的转发规则或反代给到真实后端。
`VITE_APP_BASE_API` 是唯一的前缀来源（dev 为 `/api`），代码里不要写死完整域名。

::: warning 别让 mock 变成需求文档
mock 的职责是"让 21 个菜单页面在没有后端时也能点得动"，不是复刻真实业务规则。
真接口的字段口径以对接的后端为准；发现 mock 与后端不一致时，**改 mock 去对齐后端**，
不要在前端写"两边都兼容"的分支。
:::
