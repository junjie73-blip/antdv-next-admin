import type { AppSetting, PreferencesInstance } from '@antdv/preferences';

import { normalizeLayoutMode } from '@antdv/layouts';
import { initPreferences, withDefaultPreferences } from '@antdv/preferences';

/**
 * 应用侧的偏好入口：`@antdv/preferences` 的项目适配层。
 *
 * 包本身不认识本项目的 `VITE_APP_TITLE`；"这一份配置属于 web 应用"这件事留在这里。
 * 到这里为止的翻译只剩"偏好 → DOM"（`applyPreferencesToDom` 写 CSS 变量），
 * 不再有"偏好 → 某个 UI 库的 ThemeConfig"——组件配色一律走 shadcn 规范名 token，
 * 主题只有一条链路。`ThemeStyle` 里现在只有 `geek` 还有读者（标签栏配色，
 * 见 `packages/layouts/src/basic/layout.vue:88`），原先靠 antd 算法实现的
 * `compact` 等档位随依赖一起退场。
 */

export type {
  AppSetting,
  ComponentSize,
  ContentMode,
  LayoutMode,
  NotificationPosition,
  PreferenceKey,
  PreferencesListener,
  PreferencesOptions,
  RouteMode,
  TabStyle,
  ThemeMode,
  ThemeStyle,
  TransitionEffect,
} from '@antdv/preferences';

export {
  applyPreferencesToDom,
  clearPreferencesFromDom,
  createPreferences,
  createToggles,
  DEFAULT_PREFERENCES,
  initPreferences,
  usePreferences,
  withDefaultPreferences,
} from '@antdv/preferences';

export { createSystemDark, resolveThemeMode } from '@antdv/utils';

/**
 * 项目级默认值。
 *
 * `import.meta.env` 只出现在应用源码里（包的 dist 产物拿不到 Vite 的静态替换），
 * 由这里注入到偏好实例。
 */
export const APP_DEFAULTS: AppSetting = withDefaultPreferences({
  copyrightCompany: import.meta.env.VITE_APP_TITLE || 'Antdv Admin',
  watermarkContent: import.meta.env.VITE_APP_TITLE || 'Admin',
});

/** @deprecated 用 `APP_DEFAULTS`（默认值）或 `getPreferences().get()`（当前值） */
export const DEFAULT_SETTING: AppSetting = APP_DEFAULTS;

/**
 * 读缓存时的形态迁移。
 *
 * 布局从 3 种扩展到 7 种后，老名字（`'mixed'` / `'split-vertical'`）在
 * `AppSetting` 的联合类型里已经不存在了；不迁移的话 `pickKnownPreferences`
 * 会因为类型不匹配而丢掉这个键，用户升级后布局凭空回到默认的"垂直"。
 * 迁移只发生在读取阶段，下一次落盘写的就是新值。
 */
function migratePreferences(
  cached: Record<string, unknown>,
): Record<string, unknown> {
  if (typeof cached.layout !== 'string') return cached;
  return { ...cached, layout: normalizeLayoutMode(cached.layout) };
}

/**
 * 偏好单例（懒创建，实例由包持有）。
 *
 * 顶层直接 `initPreferences()` 会在 `bootstrap/env` 注入缓存前缀之前执行，
 * 于是读写的都是默认 `app_cache_*` 而不是项目前缀的键——
 * 表现是"设置保存了但刷新就丢"，比报错难查得多。
 * 所以这里保持"第一次用时才建"，建好的那份就是 `usePreferences()` 拿到的那份。
 */
export function getPreferences(): PreferencesInstance {
  return initPreferences({
    defaults: APP_DEFAULTS,
    migrate: migratePreferences,
  });
}
