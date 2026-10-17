import type { AppSetting, ThemeMode, ThemeStyle } from '@antdv/types';
import type { ThemeConfig } from 'antdv-next';

import { theme } from 'antdv-next';

import { BORDER_RADIUS_BASE } from '@antdv/shared/constants';
import { resolveThemeMode } from '@antdv/utils';

import { darkComponents } from './dark/components';
import { darkToken } from './dark/token';
import { lightComponents } from './light/components';
import { lightToken } from './light/token';

export { darkComponents, darkToken } from './dark';
export { lightComponents, lightToken } from './light';

/**
 * antd 主题算法：单个派生函数，或算法数组（如 `[darkAlgorithm, compactAlgorithm]`）。
 *
 * `antdv-next` 只在 `theme` 子模块里导出 `MappingAlgorithm`（单函数版），
 * 根入口没有，从根导入会直接 TS2614；这里直接从 `ThemeConfig` 派生，
 * 覆盖 antd 允许的全部写法，换 antdv 版本时只改这一行。
 *
 * 它和 `ThemePreset` 都住在应用侧：形状完全由 antd `ThemeConfig` 决定，
 * 而类型契约包（`@antdv/types`）不认识任何 UI 库。
 */
export type ThemeAlgorithm = NonNullable<ThemeConfig['algorithm']>;

export interface ThemePreset {
  name: string;
  label: string;
  algorithm?: ThemeAlgorithm;
  token?: Record<string, unknown>;
  components?: Record<string, Record<string, unknown>>;
}

/** antd 默认基准：字号从它派生（圆角基准用 `@antdv/shared` 的 `BORDER_RADIUS_BASE`） */
const BASE_FONT_SIZE = 16;

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
    (style === 'compact'
      ? [baseAlgorithm, theme.compactAlgorithm]
      : baseAlgorithm);

  return {
    algorithm,
    token: {
      ...(isDark ? darkToken : lightToken),
      ...preset?.token,
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
      ...preset?.components,
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
        ? radiusScale * BORDER_RADIUS_BASE
        : BORDER_RADIUS_BASE,
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
