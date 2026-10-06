import { defineNitroConfig } from 'nitropack/config';

/**
 * Mock 服务（Nitro）
 *
 * - 目录约定：`server/api/**` 自动挂到 `/api/**`，与前端 `VITE_APP_BASE_API=/api` 对齐，
 *   因此 handler 文件路径就是接口路径，例如 `server/api/system/user/list.get.ts` → `GET /api/system/user/list`；
 * - 运行时控制面：`server/api/mock-center/**` 提供清单 / 延迟 / 停用 / 失败注入 / 命中日志，
 *   供 apps/web 的「Mock 数据中心」面板调用；
 * - dev 由 apps/web 的 vite proxy 透传（见 apps/web/build/utils/proxy.ts），
 *   所以这里额外打开 CORS，方便直接访问 5320 端口调试。
 */
export default defineNitroConfig({
  compatibilityDate: '2025-06-01',
  devServer: { port: Number(process.env.PORT ?? 5320) },
  nitroTypesPath: '.nitro/types/types.d.ts',
  preset: 'node-server',
  routeRules: {
    '/**': { cors: true },
  },
  runtimeConfig: {
    /** 运行时配置持久化文件（面板改动的延迟/停用/生成接口写这里） */
    stateFile: '.mock-state.json',
  },
  srcDir: 'server',
  typescript: { strict: true },
});
