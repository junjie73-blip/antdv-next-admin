import { defineConfig } from 'nitro';

/**
 * Mock 服务（Nitro v3）
 *
 * - 目录约定：`backend-mock/server/api/**` 自动挂到 `/api/**`，与前端 `VITE_APP_BASE_API=/api` 对齐，
 *   因此 handler 文件路径就是接口路径，例如 `backend-mock/server/api/system/user/list.get.ts` → `GET /api/system/user/list`；
 * - 运行时控制面：`backend-mock/server/api/mock-center/**` 提供清单 / 延迟 / 停用 / 失败注入 / 命中日志，
 *   供本子包的「Mock 数据中心」面板调用；
 * - dev 由 web 的官方 `nitro/vite` 插件与前端共用同一个 Vite dev server（不再有 5320 端口），
 *   保留 CORS 仅为脚本直连进程内 Nitro 抓取快照时提供便利。
 *
 * Nitro v3 迁移要点（对照官方 migration guide）：
 * - 包名 nitropack → nitro，defineNitroConfig → defineConfig；
 * - srcDir → serverDir（v3 默认不扫描目录，必须显式开启）；
 * - 自动导入 / #imports 全部移除，handler 改从 `nitro` / `nitro/h3` 显式导入；
 * - 内置数据库层：experimental.database = true，default 连接用 db0 的 sqlite（node:sqlite）连接器，
 *   业务代码用 `useDatabase()` 取连接，`db.exec(SQL)` 可直接执行建库/建表脚本；
 * - better-sqlite3 仍显式 external：运维脚本走 db0 的 node-sqlite 连接器（零原生依赖），
 *   但保留 better-sqlite3 作为可选高性能驱动，避免打包器处理 .node 二进制。
 */
export default defineConfig({
  compatibilityDate: '2025-06-01',
  // v3：node-server preset 仍有效（node 现在是它的别名）
  preset: 'node-server',
  // v3：必须显式开启目录扫描；官方 Vite 插件以 apps/web 为 rootDir，
  // 迁移后的 mock 源码集中放在 backend-mock/ 下，避免与前端目录混杂。
  serverDir: './backend-mock/server',
  // v3：内置数据库层（基于 db0）+ 实验性 Tasks
  experimental: { database: true, tasks: true },
  // WebSocket：/\_ws 端点由 server/routes/_ws.ts 提供（CrossWS）
  features: { websocket: true },
  /**
   * KV（unstorage）：mock 挂载点持久化运行参数。
   * fs 驱动在 dev 相对 rootDir、生产相对进程 cwd 解析，二者都落在 .data/kv。
   * 通过 /_mock/kv/* 修改后下一次请求立即生效，重启不丢。
   */
  kv: {
    // unstorage v2 的 fs 驱动用 `base`（v1 叫 dir）
    mock: { driver: 'fs', base: '.data/kv' },
  },
  /**
   * 缓存：默认 memory（进程内 LRU，重启即空），避免跨次快照验证拿到旧值；
   * 需要跨进程共享时改成 fs 或 kv（见 docs/RUNTIME_CAPABILITIES.md）。
   */
  cache: {
    driver: 'memory',
    memory: { maxSize: 2000 },
  },
  /** 任务元数据：实现位于 server/tasks/mock/*.ts，由 Nitro 按目录扫描 */
  tasks: {
    'mock:generate': {
      description: '生成样例数据写入 KV 并通过 WebSocket 广播',
    },
    'mock:refresh': {
      description: '刷新热点缓存快照并推送变更通知',
    },
    'mock:cleanup': {
      description: '清理过期 KV 键、截断任务历史、回收缓存',
    },
  },
  /**
   * 定时调度默认只登记不生效：cron 触发的任务带 scheduledTime，
   * helpers.ts 检查 MOCK_SCHEDULER_ENABLED=1 才真正执行，保证快照可复现。
   */
  scheduledTasks: {
    '0 * * * *': 'mock:generate',
    '*/5 * * * *': 'mock:refresh',
    '*/10 * * * *': 'mock:cleanup',
  },
  database: {
    default: {
      connector: 'sqlite',
      options: (() => {
        const file = process.env.MOCK_DB_FILE || '.data/mock.sqlite';
        // db0 的 node-sqlite 连接器：':memory:' 需走 name（它硬编码该判断），
        // 否则用 path 传相对 cwd 的完整路径。与 connection.ts 共用同一文件。
        return file === ':memory:'
          ? { name: ':memory:' }
          : { path: file };
      })(),
    },
  },
  // Nitro v3：`externals.external` 已移除（改为 noExternals，语义相反）。
  // 数据层已走 db0 的 node:sqlite 内置连接器（零原生依赖），无需手动 external；
  // better-sqlite3 仅运维脚本可选使用，不进入 Nitro 运行时依赖图。
  // v3：cors 由 h3-rules 运行时处理，补 headers 保证 CDN/静态资源也带上
  routeRules: {
    '/**': {
      cors: true,
      headers: { 'access-control-allow-origin': '*' },
    },
  },
  runtimeConfig: {
    /** 运行时配置持久化文件（面板改动的延迟/停用/生成接口写这里） */
    stateFile: '.mock-state.json',
  },
  // Nitro v3：typescript.strict 已移除，严格模式由 tsconfig.json 控制。
});
