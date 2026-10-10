import type {
  AppSetting,
  ThemeAlgorithm,
  ThemeMode,
  ThemePreset,
  ThemeStyle,
} from '@antdv/types';
import type { ThemeConfig } from 'antdv-next';

import { theme } from 'antdv-next';

import { resolveThemeMode } from '../theme-mode';
import { darkComponents, darkToken } from './dark';
import { lightComponents, lightToken } from './light';

export { darkComponents, darkToken } from './dark';
export { lightComponents, lightToken } from './light';
export { palette } from './palette';

/** antd 默认基准：字号与圆角都从它派生 */
const BASE_FONT_SIZE = 16;
const BASE_BORDER_RADIUS = 8;

export interface ThemeOverrides {
  /** antd 的 borderRadius 是 px，偏好里存的是倍率，转换在 `themeOverridesFrom` 完成 */
  borderRadius?: number;
  fontSize?: number;
  primaryColor?: string;
}

/* ============================================================
 * 主题风格预设
 *
 * `ThemeStyle` 联合里有 11 个值，包不可能内置全部视觉方案，
 * 但必须给项目留一个注入口——否则设置面板里的"风格"下拉就是个摆设。
 * 内置只实现 `compact`（antd 官方有 compactAlgorithm），
 * 其余风格由 `registerThemePreset` 注册，未注册时安全回落到 default。
 * ============================================================ */
const presetRegistry = new Map<string, ThemePreset>();

export function registerThemePreset(
  name: (string & {}) | ThemeStyle,
  preset: ThemePreset,
): void {
  presetRegistry.set(name, preset);
}

export function getThemePreset(name: ThemeStyle): ThemePreset | undefined {
  return presetRegistry.get(name);
}

export function clearThemePresets(): void {
  presetRegistry.clear();
}

/**
 * 按主题模式 + 风格返回 ConfigProvider 的完整配置。
 *
 * @param mode 'light' | 'dark' | 'auto'
 * @param isSystemDark 系统偏好（`auto` 模式用它解析出明暗）
 * @param overrides 运行时覆盖（用户改主色、圆角、字号等）
 * @param style 主题风格；`compact` 走 antd 的 compactAlgorithm，其余查预设注册表
 */
export function getAntdTheme(
  mode: ThemeMode = 'light',
  isSystemDark = false,
  overrides: ThemeOverrides = {},
  style: ThemeStyle = 'default',
): ThemeConfig {
  const isDark = resolveThemeMode(mode, isSystemDark) === 'dark';
  const baseAlgorithm = isDark ? theme.darkAlgorithm : theme.defaultAlgorithm;

  const preset = getThemePreset(style);
  const algorithm: ThemeAlgorithm =
    preset?.algorithm ??
    (style === 'compact' ? [baseAlgorithm, theme.compactAlgorithm] : baseAlgorithm);

  return {
    algorithm,
    token: {
      ...(isDark ? darkToken : lightToken),
      ...(preset?.token ?? {}),
      /* 用户运行时覆盖：顺序在后，优先级最高 */
      ...(overrides.primaryColor && {
        colorPrimary: overrides.primaryColor,
        /*
         * `colorLink` 必须和主色一起给：antd 把它绑在自己的 `#1677ff` 上而不是
         * `colorPrimary`，只换主色的话，`type="link"` 的按钮、超链接、
         * Typography 的可点文字全都不动 —— 正是"换了主题色，link 按钮还是蓝的"。
         * 给了种子值之后，`colorLinkHover / colorLinkActive` 由算法跟着派生。
         */
        colorLink: overrides.primaryColor,
      }),
      ...(overrides.borderRadius !== undefined && {
        borderRadius: overrides.borderRadius,
      }),
      ...(overrides.fontSize !== undefined && { fontSize: overrides.fontSize }),
    },
    components: {
      ...(isDark ? darkComponents : lightComponents),
      ...(preset?.components ?? {}),
    },
  };
}

/** 把偏好里的倍率/兜底值转成 antd 能直接吃的 token */
export function themeOverridesFrom(preferences: AppSetting): ThemeOverrides {
  const radiusScale = Number(preferences.borderRadius);
  const fontSize = Number(preferences.fontSize);

  return {
    // 0 / NaN 都回到 antd 基准，避免整个组件树字号塌陷成 0
    fontSize: fontSize > 0 ? fontSize : BASE_FONT_SIZE,
    borderRadius:
      Number.isFinite(radiusScale) && radiusScale >= 0
        ? radiusScale * BASE_BORDER_RADIUS
        : BASE_BORDER_RADIUS,
    primaryColor: preferences.primaryColor,
  };
}

/**
 * 偏好 → ConfigProvider theme。
 *
 * 旧签名是 `getThemeConfig(themeStyle, themeMode === 'dark', appSetting)`：
 * 第二个参数在 `theme: 'auto'`（默认值！）下恒为 false，
 * 于是"跟随系统"永远解析成浅色。现在把系统偏好作为第二个参数显式传入，
 * 明暗判定统一交给 `resolveThemeMode`。
 */
export function getThemeConfig(
  preferences: AppSetting,
  isSystemDark = false,
): ThemeConfig {
  return getAntdTheme(
    preferences.theme,
    isSystemDark,
    themeOverridesFrom(preferences),
    preferences.themeStyle,
  );
}

/* ============================================================
 * 国际化：antd locale 按需动态加载
 * ============================================================ */
export const DEFAULT_LOCALE = 'zh-CN';

/** locale 模块的运行时形状：默认导出即 antd 的 locale 对象 */
export type LocaleModule = { default: unknown };

const LOCALE_LOADERS: Record<string, () => Promise<LocaleModule>> = {
  'en-US': () => import('antdv-next/locale/en_US'),
  'zh-CN': () => import('antdv-next/locale/zh_CN'),
  'zh-TW': () => import('antdv-next/locale/zh_TW'),
};

export const SUPPORTED_LOCALES = Object.keys(LOCALE_LOADERS);

/** 取 loader 而不是直接取模块：调用方可以自己决定何时触发网络/分包加载 */
export function getLocaleModule(locale: string): () => Promise<LocaleModule> {
  return LOCALE_LOADERS[locale] ?? LOCALE_LOADERS[DEFAULT_LOCALE]!;
}

/** 直接拿到 locale 对象，供 `ConfigProvider :locale` 用 */
export async function loadLocale(
  locale: string,
): Promise<null | undefined | unknown> {
  const loader = getLocaleModule(locale);
  try {
    const module = await loader();
    return module.default;
  } catch {
    // 语言包加载失败不该白屏：退回默认语言
    if (locale === DEFAULT_LOCALE) return null;
    return loadLocale(DEFAULT_LOCALE);
  }
}
