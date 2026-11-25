# backend-mock 运行时能力使用说明

本子包在 Nitro v3 原生能力之上提供四类运行时特性：**WebSocket 实时推送**、**Tasks 异步调度**、**KV 持久化配置**与**缓存策略**。所有控制端点都放在 `server/routes/_mock/**` 与 `server/routes/_ws.ts`，不进入 `/api/**` 的 mock 清单与快照基线（127 条），因此开启这些能力不会改变前端已对接的接口契约。

响应体始终沿用 `{ code, data, message }` 三字段信封；链路号、耗时走 HTTP 响应头（`x-request-id` / `x-trace-id` / `x-response-time`）。

---

## 1. 目录结构

```
server/
  contracts/          # 状态码 / DTO / 权限 / 实时消息 / KV / 任务 契约（单一真源）
  utils/
    realtime/hub.ts   # WebSocket 连接表（globalThis 单例）、广播、事件工厂
    kv/mock-kv.ts     # useKV('mock') 的键规则 / schema / 默认值封装
    cache/policies.ts # defineCachedFunction 封装：动态 TTL / key 模板 / 失效
    tasks/helpers.ts  # 调度开关、耗时、历史落盘、异常收口
  tasks/mock/         # Nitro 按目录扫描的 3 个任务
  routes/
    _ws.ts            # ws(s)://host/_ws
    _mock/            # 运行时控制端点（不进快照）
      realtime/       # 连接查询、广播
      kv/             # 全局配置、单接口覆盖、任务历史
      cache/          # 策略查询/修改、失效、缓存示例
      tasks/          # 任务清单、手动执行
```

---

## 2. 配置项（`nitro.config.ts`）

| 配置 | 值 | 作用 |
| --- | --- | --- |
| `features.websocket` | `true` | 开启 CrossWS 升级支持 |
| `experimental.tasks` | `true` | 开启 Nitro Tasks（v3 仍属实验特性） |
| `experimental.database` | `true` | 既有 SQLite 能力，保持不变 |
| `kv.mock` | `{ driver: 'fs', base: '.data/kv' }` | **unstorage v2** 的 fs 驱动，注意键名是 `base` 而非 v1 的 `dir` |
| `cache.driver` | `'memory'` | 缓存默认进程内 LRU；改 `'fs'` / `'kv'` 可跨进程共享 |
| `tasks` | 3 个任务描述 | 与 `contracts/tasks.ts` 的注册表保持一致 |
| `scheduledTasks` | 3 条 cron | 定时触发默认跳过，见下方开关 |

> 依赖：`nitro@3.0.261103-rc` 要求 `unstorage >= 2.0.0-alpha.10`（本仓库锁 `2.0.0-alpha.11`）；db0 仍用 1.x，由 pnpm 各自隔离，互不冲突。

**调度开关**：cron 触发的任务 payload 带 `scheduledTime`，`utils/tasks/helpers.ts` 只有在 `MOCK_SCHEDULER_ENABLED=1` 时才真正执行；HTTP 手动触发不受影响。这样 `pnpm mock:fixtures` 期间不会因为后台任务写 KV 导致快照漂移。

```bash
# 开发环境开启定时调度
MOCK_SCHEDULER_ENABLED=1 pnpm dev
```

---

## 3. WebSocket 实时推送

### 连接

```
ws://localhost:5320/_ws?traceId=optional-trace-id
```

连接成功后服务端立即发送 `mock:connected`；断开时向系统频道广播 `mock:client-left`。默认订阅 `mock:data` 与 `mock:system`，审计频道需显式订阅。

### 消息格式

服务端 → 客户端：

```json
{
  "id": "uuid",
  "type": "mock:data-generated",
  "channel": "mock:data",
  "at": "2026-11-25T10:00:00.000Z",
  "payload": { "count": 3 },
  "traceId": "optional"
}
```

客户端 → 服务端命令：

```json
{ "type": "subscribe", "channel": "mock:audit" }
{ "type": "unsubscribe", "channel": "mock:audit" }
{ "type": "ping" }
{ "type": "broadcast", "channel": "mock:data", "event": { "type": "mock:custom", "payload": {} } }
```

非法命令返回 `mock:error`（带 zod issue 详情）。

### 频道

| 频道 | 用途 |
| --- | --- |
| `mock:data` | 数据生成 / 刷新通知（默认订阅） |
| `mock:audit` | 审计类事件（需订阅） |
| `mock:system` | 连接上下线、命令回执、清理通知（默认订阅） |

### HTTP 控制端点

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/_mock/realtime/clients` | 列出连接 id / 频道 / 连接时间 |
| POST | `/_mock/realtime/broadcast` | 服务端广播；`clientId` 存在时改为点对点 |

```bash
curl -X POST -H 'content-type: application/json' \
  -d '{"type":"mock:data-generated","payload":{"count":1},"channel":"mock:data"}' \
  http://localhost:6080/_mock/realtime/broadcast
```

**前端接入示例**：

```ts
const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${location.host}/_ws`);
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'mock:data-generated') refreshTable();
});
```

---

## 4. Tasks 异步调度

| 任务名 | cron | 作用 |
| --- | --- | --- |
| `mock:generate` | `0 * * * *` | 按 `count` 生成样例数据写入 KV，并广播 `mock:data-generated` |
| `mock:refresh` | `*/5 * * * *` | 重建缓存实例、写刷新快照、广播 `mock:data-refreshed` |
| `mock:cleanup` | `*/10 * * * *` | 删除带 `expiresAt` 的临时键、截断历史、失效缓存 |

任务只写 KV / 缓存，不改种子数据库，因此不会污染 GET 快照。

```bash
curl http://localhost:6080/_mock/tasks
curl -X POST -H 'content-type: application/json' \
  -d '{"payload":{"count":5}}' \
  http://localhost:6080/_mock/tasks/mock:generate
```

返回 `data` 为标准结果：`{ ok, name, at, durationMs, source, result }`。执行历史写入 KV，通过 `GET /_mock/kv/history` 查询（最多 100 条）。

新增任务：在 `server/tasks/mock/` 建文件 → `defineTask({ meta, run })` → 在 `contracts/tasks.ts` 的 `MOCK_TASK_NAMES` / `MOCK_TASKS` 登记 → 需要定时则在 `nitro.config.ts` 的 `scheduledTasks` 加 cron。

---

## 5. KV 持久化与运行时覆盖

挂载点 `mock` 对应 `useKV('mock')`，数据落在 `.data/kv`。键集中定义在 `contracts/runtime-kv.ts`：

| 键 | 内容 |
| --- | --- |
| `config/global` | `{ defaultDelayMs, overridesEnabled }` |
| `overrides/<encodeURIComponent(routeKey)>` | 单接口覆盖 |
| `config/cache-policies` | 缓存策略表 |
| `tasks/history` | 任务执行历史 |
| `generated/latest` / `refreshed/latest` | 任务产出快照 |

**单接口覆盖字段**：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `routeKey` | string | 清单 key，形如 `[GET]/menus` |
| `delayMs` | int 0~10000 | 人为延迟，联调 loading / 超时态 |
| `enabled` | boolean | `false` = 立即返回 503 |
| `statusCode` | int | 覆盖业务码，返回标准错误信封 |
| `response` | any | 覆盖响应 data，原样进入信封 |
| `note` | string | 运维备注 |

```bash
# 让 GET /api/menus 延迟 120ms 并返回固定值，下一次请求立即生效
curl -X POST -H 'content-type: application/json' \
  -d '{"routeKey":"[GET]/menus","delayMs":120,"response":{"list":[]}}' \
  http://localhost:6080/_mock/kv/overrides

curl -X DELETE "http://localhost:6080/_mock/kv/overrides/%5BGET%5D%2Fmenus"
```

实现位置：`runtime.ts` 的 `resolveKvHandler()` 在每次请求前读 KV（先查 `overridesEnabled`），KV 异常时静默回落到原 handler。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/_mock/kv/config` | 全局配置 + 覆盖项数量 |
| POST | `/_mock/kv/config` | 改默认延迟 / 覆盖开关 |
| GET | `/_mock/kv/overrides` | 列出覆盖 |
| POST | `/_mock/kv/overrides` | 新增/更新覆盖 |
| DELETE | `/_mock/kv/overrides/:routeKey` | 删除覆盖（routeKey 需 URL 编码） |
| GET | `/_mock/kv/history` | 任务历史 |

---

## 6. 缓存策略

基于 `nitro/cache` 的 `defineCachedFunction`；`createMockCache(name, loader, { getKey })` 返回带动态策略的缓存函数：

```ts
import { createMockCache } from '../../utils/cache/policies';

const getDict = createMockCache(
  'dict:list',
  async (type: string) => queryDict(type),
  { getKey: (type) => type },
);
```

- TTL / SWR / key 模板从 KV `config/cache-policies` 读取，改完把 generation +1，旧条目立刻不再命中；
- `maxAge: 0` 直接绕过缓存；
- `keyTemplate` 支持 `{0}` `{1}` 占位符，按顺序替换函数参数；
- **禁止缓存按 token 分数据的接口**（如 `/menus`、`/auth/user-info`），否则会串号；这些接口在 `defineMockRoute` 里已强制 `cache-control: no-store` 与 `Vary: Authorization`。

现成示例：`GET /_mock/cache/demo?keyword=&pageNum=1&pageSize=10`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/_mock/cache/policies` | 策略表 + 活跃缓存实例数 |
| POST | `/_mock/cache/policies` | 改 `maxAge` / `swr` / `keyTemplate` |
| POST | `/_mock/cache/invalidate` | 失效指定策略或全部 |

```bash
curl -X POST -H 'content-type: application/json' \
  -d '{"name":"dict:list","maxAge":10,"swr":true,"keyTemplate":"{0}"}' \
  http://localhost:6080/_mock/cache/policies
```

---

## 7. 验证命令

```bash
pnpm --filter @antdv/web exec tsc --noEmit -p backend-mock/tsconfig.json
pnpm --filter @antdv/web run test:server
pnpm --filter @antdv/web run verify:environments
pnpm --filter @antdv/web run verify:mock
```

开发态由 `pnpm dev:web` 的官方 `nitro/vite` 插件在 6080 端口同时提供页面、`/api/**` 与 `/_ws`；生产静态包由 `verify:mock` 验证包内浏览器 mock。快照生成器与对账脚本都固定在内存库上运行，避免上一次抓取的写副作用造成假差异。

> 注意：快照生成前请确认 `apps/web/.data/kv/overrides/` 为空，否则 KV 覆盖会改变 GET 响应导致 127/127 对账失败。
