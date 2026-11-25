import type { PluginOption } from 'vite';

import { defineApplicationConfig } from '@antdv/vite-config';
import { nitro } from 'nitro/vite';

/**
 * Nitro 官方 Vite 插件只在 `vite dev` 期间启用：
 * 前端模块继续走 Vite HMR，`server/**` 的 API / WebSocket 由同一个 dev server 提供，
 * 不再另起 5320 端口、也不再配置 `/api` 反向代理。
 *
 * `apply: 'serve'` 保证 `vite build` 仍产出纯静态 `dist`，沿用仓库既有的生产
 * 浏览器内 mock 方案；测试侧还会在 vitest.config 里按插件名剔除 Nitro 插件。
 */
function serveOnlyNitro(): PluginOption[] {
  const flatten = (plugins: PluginOption[]): PluginOption[] =>
    plugins.flat(Infinity).flatMap((plugin) => {
      if (!plugin) return [];
      if (Array.isArray(plugin)) return flatten(plugin);
      return [{ ...plugin, apply: 'serve' as const }];
    });

  return flatten(nitro());
}

/**
 * 应用侧只保留「这个项目独有」的东西，其余全在 `@antdv/vite-config`：
 *
 * - 别名（`~` → src、`#` → types）与 vue 单例 dedupe → common
 * - 插件装配（vue/jsx、auto-import、svg-icons、PWA、压缩、app-loading…）→ application
 * - dev server 端口与用户自定义代理 → application + VITE_* 环境变量
 * - 分包策略与 dropConsole/dropDebugger → application
 * - `__APP_INFO__`（构建时间 + 依赖清单）→ application（读本目录 package.json）
 * - Nitro mock 服务 → 本文件内联的官方 `nitro/vite` 插件（仅 dev）
 *
 * 需要偏离默认时走 `overrides`，最后一层深合并，不会顶掉共享插件。
 */
export default defineApplicationConfig({
  base: './',
  plugins: serveOnlyNitro(),
});
