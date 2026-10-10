import { defineApplicationConfig } from '@antdv/vite-config';

/**
 * 应用侧只保留「这个项目独有」的东西，其余全在 `@antdv/vite-config`：
 *
 * - 别名（`~` → src、`#` → types）与 vue 单例 dedupe → common
 * - 插件装配（vue/jsx、auto-import、svg-icons、PWA、压缩、Nitro Mock、app-loading…）→ application
 * - dev server 端口与 `/api` → Nitro Mock 代理 → application + VITE_* 环境变量
 * - 分包策略与 dropConsole/dropDebugger → application
 * - `__APP_INFO__`（构建时间 + 依赖清单）→ application（读本目录 package.json）
 *
 * 需要偏离默认时走 `overrides`，最后一层深合并，不会顶掉共享插件。
 */
export default defineApplicationConfig({
  base: './',
});
