import type { PluginOption } from 'vite'

import { vitePluginFakeServer } from 'vite-plugin-fake-server'

/**
 * Mock 服务：完全按 vite-plugin-fake-server 的官方约定挂载。
 *
 * - `include: 'mock'` + 默认 `.fake.ts` 中缀：mock 目录下每个 `<名字>.fake.ts` 就是一个接口文件，
 *   `_runtime.ts`、`store.ts` 不带中缀，插件天然忽略，不需要 exclude；
 * - 文件默认导出 `FakeRoute[]`（`{ url, method, statusCode, timeout, response }`），
 *   延迟 / 停用 / 失败注入由 `_runtime.ts` 的 `withRuntime` 在响应函数外层实现，改面板配置不需要重启；
 *
 * 环境区分：
 * - development：`enableDev` 生效，插件用 Connect 在 dev server 上挂真实 HTTP 接口；
 * - production：`enableProd` 恒为 false。插件的生产模式基于 XHook 拦截，官方明确 fake 文件里不能用
 *   node 模块，而 `_runtime.ts` / `mock-center.fake.ts` 依赖 `node:fs`、`node:http`，
 *   所以生产构建只走真实接口，mock 代码与 /mock-center 面板接口都不进产物；
 * - 需要离线演示站点时改 `build: { port: 8888 }` 导出独立 fake server，而不是打开 `enableProd`。
 *
 * `timeout` 留空：响应延迟交给面板的运行时配置，避免两处各设一份。
 */
export function createMockPlugin(mode: string): PluginOption {
  const isBuild = mode === 'production'

  return vitePluginFakeServer({
    build: false,
    enableDev: !isBuild,
    enableProd: false,
    extensions: ['ts'],
    include: 'mock',
    logger: true,
    watch: true,
  })
}
