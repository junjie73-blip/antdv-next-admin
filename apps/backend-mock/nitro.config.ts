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
  // 端口不写在配置里：nitropack 2.13 的 `devServer` 只接受 `watch` 一类字段，
  // `port` 不在类型里（写上去会静默失效）。独立跑 `pnpm --filter @antdv/backend-mock dev`
  // 时用环境变量 PORT / NITRO_PORT 指定，默认 5320。
  // dev 场景不用管：apps/web 的 vite 插件（internal/vite-config 的 nitro-mock）
  // 拿到端口后走 createDevServer(...).listen(port) 编程式监听，5320 由插件侧传入。
  //
  // 类型产物路径同理没有 `nitroTypesPath` 这个选项（2.13 固定在 `<buildDir>/types` 下），
  // 而 tsconfig 是按 `.nitro/types/*.d.ts` 通配引入的，所以不需要显式指定文件名。
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
