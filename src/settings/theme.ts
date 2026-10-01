import type { ThemeConfig } from 'antdv-next'

import { theme } from 'antdv-next'

import type { AppSetting, ThemeStyle } from '#/app'

type MappingAlgorithm = (token: any) => any

const { darkAlgorithm, defaultAlgorithm } = theme

function getThemeConfig(style: ThemeStyle, isDark: boolean, appSetting: AppSetting): ThemeConfig {
  const preset: ThemeConfig = {
    algorithm: defaultAlgorithm,
    token: {
      colorPrimary: '#1677ff',
      borderRadius: 6,
    },
  }
  const algorithm: MappingAlgorithm[] = []

  if (isDark && style !== 'dark') {
    algorithm.push(darkAlgorithm)
  } else {
    algorithm.push(defaultAlgorithm)
  }
  const token: ThemeConfig['token'] = {
    ...preset.token,
    fontSize: appSetting?.fontSize || 16,
    borderRadius: appSetting?.borderRadius * 8,
    colorPrimary: appSetting?.primaryColor,
  }
  if (isDark) {
    token.colorBgContainer = '#101828'
  }
  return {
    algorithm,
    token,
    components: preset.components,
  }
}

function getLocaleModule(locale: string) {
  const localeMap: Record<string, () => Promise<unknown>> = {
    'zh-CN': () => import('antdv-next/locale/zh_CN'),
    'en-US': () => import('antdv-next/locale/en_US'),
    'ja-JP': () => import('antdv-next/locale/ja_JP'),
    'ko-KR': () => import('antdv-next/locale/ko_KR'),
    'zh-TW': () => import('antdv-next/locale/zh_TW'),
  }

  return localeMap[locale] || localeMap['zh-CN']
}

export { getLocaleModule, getThemeConfig }
