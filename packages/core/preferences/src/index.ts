/**
 * `@antdv/preferences` —— 用户偏好设置子包。
 *
 * 边界（刻意不做什么）：
 * - 不依赖 pinia / vue-router / 任何应用侧 store：偏好是"设置项"，不是"业务状态"；
 * - 不依赖任何具体 UI 库：偏好只落到 CSS 变量与 `<html>` 的 class/属性上，
 *   "偏好 → antd `ThemeConfig`" 这类翻译属于消费方（见 `apps/web/src/settings/theme`）；
 * - 不读 `import.meta.env`：包体在 `dist/` 里，Vite 的静态替换够不到它，
 *   需要项目差异值（标题、公司名）时由应用通过 `defaults` 注入；
 * - 不内置 DOM 之外的副作用（发请求、写 cookie）。
 *
 * 典型用法：
 * ```ts
 * initPreferences({
 *   defaults: withDefaultPreferences({
 *     watermarkContent: import.meta.env.VITE_APP_TITLE,
 *   }),
 * });
 * usePreferences().patch({ primaryColor: '#f5222d' });
 * ```
 */

export * from './boot-theme';
export * from './config';
export * from './constants';
export * from './preferences';
export * from './types';
export * from './update-css-variables';
export * from './use-preferences';
