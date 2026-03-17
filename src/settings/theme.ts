import type { ThemePreset, ThemeStyle } from '#/app'
import type { ThemeConfig } from 'antdv-next'
import { theme } from 'antdv-next'

type MappingAlgorithm = (token: any) => any

const { darkAlgorithm, defaultAlgorithm, compactAlgorithm } = theme

const THEME_PRESETS: Record<ThemeStyle, ThemePreset> = {
  default: {
    name: 'default',
    label: '默认风格',
    algorithm: defaultAlgorithm,
    token: {
      colorPrimary: '#1677ff',
      borderRadius: 6,
    },
  },
  dark: {
    name: 'dark',
    label: '暗黑风格',
    algorithm: darkAlgorithm,
    token: {
      colorPrimary: '#1677ff',
      borderRadius: 6,
    },
  },
  compact: {
    name: 'compact',
    label: '紧凑风格',
    algorithm: compactAlgorithm,
    token: {
      colorPrimary: '#1677ff',
      borderRadius: 4,
    },
    components: {
      Button: {
        controlHeight: 28,
        paddingContentHorizontal: 12,
      },
      Input: {
        controlHeight: 28,
        paddingInline: 8,
      },
      Select: {
        controlHeight: 28,
      },
      Table: {
        cellPaddingInline: 8,
        cellPaddingBlock: 8,
      },
    },
  },
  mui: {
    name: 'mui',
    label: '类 MUI 风格',
    algorithm: defaultAlgorithm,
    token: {
      colorPrimary: '#1976d2',
      borderRadius: 4,
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    },
    components: {
      Button: {
        controlHeight: 36,
      },
      Input: {
        controlHeight: 48,
      },
    },
  },
  shadcn: {
    name: 'shadcn',
    label: '类 shadcn 风格',
    algorithm: defaultAlgorithm,
    token: {
      colorPrimary: '#0f172a',
      borderRadius: 6,
      colorBgContainer: '#ffffff',
      colorBorder: '#e2e8f0',
    },
    components: {
      Button: {
        controlHeight: 40,
        paddingContentHorizontal: 16,
      },
    },
  },
  cartoon: {
    name: 'cartoon',
    label: '卡通风格',
    algorithm: defaultAlgorithm,
    token: {
      colorPrimary: '#ff6b6b',
      borderRadius: 16,
      colorSuccess: '#51cf66',
      colorWarning: '#fcc419',
      colorError: '#ff6b6b',
      colorInfo: '#339af0',
    },
    components: {
      Button: {
        controlHeight: 44,
      },
    },
  },
  illustration: {
    name: 'illustration',
    label: '插画风格',
    algorithm: defaultAlgorithm,
    token: {
      colorPrimary: '#845ef7',
      borderRadius: 12,
      colorSuccess: '#20c997',
      colorWarning: '#fab005',
      colorError: '#f06595',
    },
  },
  bootstrap: {
    name: 'bootstrap',
    label: '类 Bootstrap 风格',
    algorithm: defaultAlgorithm,
    token: {
      colorPrimary: '#0d6efd',
      borderRadius: 4,
      colorSuccess: '#198754',
      colorWarning: '#ffc107',
      colorError: '#dc3545',
      colorInfo: '#0dcaf0',
    },
    components: {
      Button: {
        controlHeight: 38,
        paddingContentHorizontal: 12,
      },
    },
  },
  skeuomorphism: {
    name: 'skeuomorphism',
    label: '拟物化风格',
    algorithm: defaultAlgorithm,
    token: {
      colorPrimary: '#5c5c5c',
      borderRadius: 8,
      colorBgContainer: '#f5f5f5',
      colorBorder: '#d9d9d9',
    },
    components: {
      Button: {
        controlHeight: 40,
      },
    },
  },
  glass: {
    name: 'glass',
    label: '玻璃风格',
    algorithm: defaultAlgorithm,
    token: {
      colorPrimary: '#667eea',
      borderRadius: 12,
      colorBgContainer: 'rgba(255, 255, 255, 0.72)',
      colorBgElevated: 'rgba(255, 255, 255, 0.85)',
    },
  },
  geek: {
    name: 'geek',
    label: '极客风格',
    algorithm: darkAlgorithm,
    token: {
      colorPrimary: '#00ff88',
      borderRadius: 2,
      colorBgBase: '#0a0a0a',
      colorTextBase: '#00ff88',
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
    },
    components: {
      Button: {
        controlHeight: 36,
      },
      Input: {
        controlHeight: 36,
      },
    },
  },
}

function getThemePreset(style: ThemeStyle): ThemePreset {
  return THEME_PRESETS[style] || THEME_PRESETS.default
}

function getThemeConfig(
  style: ThemeStyle,
  isDark: boolean,
  borderRadius?: number,
  primaryColor?: string,
): ThemeConfig {
  const preset = getThemePreset(style)
  const algorithm: MappingAlgorithm[] = []

  if (isDark && style !== 'dark' && style !== 'geek') {
    algorithm.push(darkAlgorithm)
  }
  else if (preset.algorithm) {
    algorithm.push(preset.algorithm)
  }

  return {
    algorithm,
    token: {
      ...preset.token,
      ...(borderRadius !== undefined && { borderRadius }),
      ...(primaryColor && { colorPrimary: primaryColor }),
    },
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

export { getLocaleModule, getThemeConfig, getThemePreset, THEME_PRESETS }
