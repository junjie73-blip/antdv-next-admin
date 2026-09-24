import * as echarts from 'echarts'

import { PALETTE } from './constants'

/** 主文本色 */
export function textColor(isDark: boolean) {
  return isDark ? '#cbd5e1' : '#64748b'
}

/** 次要文本色 */
export function subTextColor(isDark: boolean) {
  return isDark ? '#6b7280' : '#9ca3af'
}

/** 边框 / 分割线颜色 */
export function borderColor(isDark: boolean) {
  return isDark ? '#374151' : '#e5e7eb'
}

/** 坐标轴线颜色 */
export function axisLineColor(isDark: boolean) {
  return isDark ? '#334155' : '#e5e7eb'
}

/** Tooltip 背景色 */
export function tooltipBg(isDark: boolean) {
  return isDark ? 'rgba(31,41,55,0.96)' : 'rgba(255,255,255,0.96)'
}

/** 基础 option（自动应用主题色） */
export function baseOption(isDark: boolean, extra: Record<string, any> = {}) {
  return {
    backgroundColor: 'transparent',
    tooltip: {
      backgroundColor: tooltipBg(isDark),
      borderColor: borderColor(isDark),
      textStyle: { color: textColor(isDark), fontSize: 13 },
      extraCssText: 'border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.1);',
    },
    ...extra,
  }
}

/** 创建线性渐变 */
export function gradient(colors: [string, string], vertical = true) {
  return new echarts.graphic.LinearGradient(0, 0, vertical ? 0 : 1, vertical ? 1 : 0, [
    { offset: 0, color: colors[0] },
    { offset: 1, color: colors[1] },
  ])
}

/** ECharts 主题名（dark 时用 'dark'） */
export function echartsTheme(isDark: boolean): string | undefined {
  return isDark ? 'dark' : undefined
}

// 重新导出，方便图表文件使用
export { PALETTE }
