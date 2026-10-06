import type { AppSetting, ThemeStyle } from '@antdv/types';
import type { ThemeConfig } from 'antdv-next';

import { theme } from 'antdv-next';

import { darkComponents } from './dark/components';
import { darkToken } from './dark/token';
import { lightComponents } from './light/components';
import { lightToken } from './light/token';

export { palette } from './palette';

/**
 * 按主题模式返回 ConfigProvider 的完整配置
 *
 * @param mode 'light' | 'dark' | 'auto'
 * @param isSystemDark 系统偏好（auto 模式用）
 * @param overrides 运行时覆盖（用户改主色、圆角、字号等）
 */
export function getAntdTheme(
  mode: 'auto' | 'dark' | 'light',
  isSystemDark = false,
  overrides: {
    primaryColor?: string;
    borderRadius?: number;
    fontSize?: number;
    componentSize?: 'large' | 'middle' | 'small';
  } = {},
): ThemeConfig {
  const isDark = mode === 'dark' || (mode === 'auto' && isSystemDark);

  return {
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      ...(isDark ? darkToken : lightToken),
      /* 用户运行时覆盖 */
      ...(overrides.primaryColor && { colorPrimary: overrides.primaryColor }),
      ...(overrides.borderRadius !== undefined && {
        borderRadius: overrides.borderRadius,
      }),
      ...(overrides.fontSize !== undefined && { fontSize: overrides.fontSize }),
    },
    components: isDark ? darkComponents : lightComponents,
  };
}

function getThemeConfig(
  style: ThemeStyle,
  isDark: boolean,
  appSetting: AppSetting,
): ThemeConfig {
  return getAntdTheme(appSetting.theme, isDark, {
    fontSize: appSetting?.fontSize || 16,
    borderRadius: appSetting?.borderRadius * 8,
    primaryColor: appSetting?.primaryColor,
  });
}

function getLocaleModule(locale: string) {
  const localeMap: Record<string, () => Promise<unknown>> = {
    'zh-CN': () => import('antdv-next/locale/zh_CN'),
    'en-US': () => import('antdv-next/locale/en_US'),
    'ja-JP': () => import('antdv-next/locale/ja_JP'),
    'ko-KR': () => import('antdv-next/locale/ko_KR'),
    'zh-TW': () => import('antdv-next/locale/zh_TW'),
  };

  return localeMap[locale] || localeMap['zh-CN'];
}

export { getLocaleModule, getThemeConfig };
