import type { AppSetting } from '@antdv/types';

import { DEFAULT_PRIMARY_COLOR } from '@antdv/shared/constants';

import type { BooleanPreferenceKey, PreferenceKey } from './types';

/**
 * 偏好默认值。
 *
 * ⚠️ 这里**不允许**出现 `import.meta.env`：
 * 包体最终打进 `dist/`，Vite 的环境变量静态替换只作用于应用自己的源码，
 * 包内读 `import.meta.env` 会拿到 undefined，默认值就静默变成空字符串。
 * 需要标题、公司名这类"随项目而变"的字段时，由应用在 `createPreferences({ defaults })`
 * 里把自己的 env 值传进来（见 `withDefaultPreferences`）。
 *
 * 用 `satisfies` 而不是 `: AppSetting`：保留字面量键集合，
 * 单测才能用 `Exclude<keyof AppSetting, keyof typeof DEFAULT_PREFERENCES>`
 * 检查"加了字段忘了给默认值"。
 */
export const DEFAULT_PREFERENCES = {
  /* ---------- 主题 ---------- */
  theme: 'auto',
  themeStyle: 'default',
  primaryColor: DEFAULT_PRIMARY_COLOR,
  /* 倍率 1 = 8px，即 `@antdv/design` 里 `--radius-lg` 的基准档（其余档按比例派生） */
  borderRadius: 1,
  fontSize: 14,
  darkSidebar: false,
  darkHeader: false,
  colorWeak: false,
  grayMode: false,

  /* ---------- 布局 ---------- */
  layout: 'vertical',
  contentMode: 'full',
  contentWidth: 1200,
  sidebarCollapsed: false,
  sidebarWidth: 210,
  railWidth: 68,
  sidebarOverlayOpen: false,
  menuAccordion: true,
  headerMenuScroll: true,
  showTabs: true,
  tabShowIcon: true,
  tabStyle: 'card',
  tabDragSort: true,
  tabContextMenu: true,
  showBreadcrumb: true,
  hideBreadcrumbWhenOnlyOne: true,
  showBreadcrumbIcon: true,

  /* ---------- 小部件 ---------- */
  widgetNotice: true,
  widgetFullscreen: true,
  widgetTheme: true,
  widgetTimezone: false,
  widgetLogout: true,
  widgetSearch: true,
  widgetPreferences: true,
  widgetLocaleSwitcher: true,

  /* ---------- 底栏 ---------- */
  showFooter: true,
  showCopyright: true,
  copyrightCompany: 'Antdv Admin',
  copyrightIcp: '',

  /* ---------- 通用 ---------- */
  componentSize: 'medium',
  timezone: 'Asia/Shanghai',
  enableWatermark: false,
  watermarkContent: 'Admin',
  /* 通知默认右下角；轻提示不吃这个值，它固定在屏幕居中 */
  notificationPosition: 'bottomRight',
  transitionEffect: 'fade-slide',
  showProgressBar: true,
  locale: 'zh-CN',
  showLoading: true,
  routeMode: 'frontend',
} satisfies AppSetting;

/** 内置默认值的只读引用，方便应用直接展示"恢复默认"文案 */
export const BUILT_IN_DEFAULTS: Readonly<AppSetting> = DEFAULT_PREFERENCES;

/**
 * 默认值 + 应用侧覆盖，得到"这个项目的默认配置"。
 *
 * 典型用法（main.ts）：
 * ```ts
 * createPreferences({
 *   defaults: withDefaultPreferences({
 *     watermarkContent: import.meta.env.VITE_APP_TITLE || 'Admin',
 *     copyrightCompany: import.meta.env.VITE_APP_TITLE || 'Antdv Admin',
 *   }),
 * });
 * ```
 */
export function withDefaultPreferences(
  overrides: Partial<AppSetting> = {},
): AppSetting {
  return { ...DEFAULT_PREFERENCES, ...overrides };
}

/**
 * 只保留 schema 里存在的键。
 *
 * 缓存里的数据可能是老版本写的，也可能被人手改过；
 * 未识别的键既不该参与渲染，也不该被下一轮 `setItem` 带回盘上。
 */
export function pickKnownPreferences(
  source: null | Partial<AppSetting> | Record<string, unknown> | undefined,
  schema: AppSetting = DEFAULT_PREFERENCES,
): Partial<AppSetting> {
  if (!source || typeof source !== 'object') return {};
  const raw = source as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(schema) as PreferenceKey[]) {
    if (!(key in raw)) continue;
    // 类型不匹配的脏值直接丢弃，交给默认值兜底；
    // 否则一个 `primaryColor: 123` 会让色值计算整条链路崩掉。
    if (typeof raw[key] === typeof schema[key]) result[key] = raw[key];
  }
  return result as Partial<AppSetting>;
}

/** 值类型为 boolean 的偏好键（以默认值对象的实际内容为准） */
export function booleanPreferenceKeys(): BooleanPreferenceKey[] {
  return (Object.keys(DEFAULT_PREFERENCES) as PreferenceKey[]).filter(
    (key) => typeof DEFAULT_PREFERENCES[key] === 'boolean',
  ) as BooleanPreferenceKey[];
}
