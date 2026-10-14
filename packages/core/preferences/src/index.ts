/**
 * `@antdv/preferences` —— 用户偏好设置子包。
 *
 * 边界（刻意不做什么）：
 * - 不依赖 pinia / vue-router / 任何应用侧 store：偏好是"设置项"，不是"业务状态"；
 * - 不读 `import.meta.env`：包体在 `dist/` 里，Vite 的静态替换够不到它，
 *   需要项目差异值（标题、公司名）时由应用通过 `defaults` 注入；
 * - 不内置 DOM 之外的副作用（发请求、写 cookie）。
 *
 * 典型用法：
 * ```ts
 * const preferences = createPreferences({
 *   defaults: withDefaultPreferences({
 *     watermarkContent: import.meta.env.VITE_APP_TITLE,
 *   }),
 * });
 * preferences.patch({ primaryColor: '#f5222d' });
 * ```
 */

export * from './css-vars';
export * from './defaults';
export * from './store';
export * from './theme';
export * from './theme-mode';

export type {
  AppSetting,
  ComponentSize,
  ContentMode,
  LayoutMode,
  NotificationPosition,
  RouteMode,
  TabStyle,
  ThemeAlgorithm,
  ThemeMode,
  ThemePreset,
  ThemeStyle,
  TransitionEffect,
} from '@antdv/types';
