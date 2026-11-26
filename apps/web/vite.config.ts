import type { Plugin, PluginOption } from 'vite';

import { defineApplicationConfig } from '@antdv/vite-config';
import { nitro } from 'nitro/vite';

/**
 * Nitro 官方 Vite 插件只在 `vite dev` 期间启用：
 * 前端模块继续走 Vite HMR，`server/**` 的 API / WebSocket 由同一个 dev server 提供，
 * 不再另起 5320 端口、也不再配置 `/api` 反向代理。
 *
 * 不能简单写 `apply: 'serve'`：Nitro 自带的 `nitro:preview` 插件正是靠
 * `apply: (_config, env) => !!env.isPreview` 启用的，强制覆盖后 `vite preview`
 * 也会命中它，进而读取纯静态构建里不存在的 `.output/nitro.json` 并启动失败。
 * 所以这里保留每个插件自身的 apply 判定，只叠加「dev 且非 preview」这一层。
 * 生产 `dist` 仍沿用仓库既有的浏览器内 mock；vitest 侧按插件名剔除。
 */
function serveOnlyNitro(): PluginOption[] {
  const wrap = (option: PluginOption): PluginOption[] => {
    if (!option) return [];
    if (Array.isArray(option)) return option.flatMap(wrap);
    if (typeof option !== 'object' || !('name' in option)) return [option];

    const plugin = option as Plugin;
    const originalApply = plugin.apply;
    return [
      {
        ...plugin,
        apply: (config, env) =>
          env.command === 'serve' &&
          !env.isPreview &&
          (typeof originalApply === 'function'
            ? originalApply(config, env)
            : originalApply !== 'build'),
      },
    ];
  };

  return nitro().flatMap(wrap);
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
