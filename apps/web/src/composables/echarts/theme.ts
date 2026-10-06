import * as echarts from 'echarts/core'

export function textColor(isDark: boolean) {
  return isDark ? '#cbd5e1' : '#64748b'
}
export function subTextColor(isDark: boolean) {
  return isDark ? '#6b7280' : '#9ca3af'
}
export function borderColor(isDark: boolean) {
  return isDark ? '#374151' : '#e5e7eb'
}
export function axisLineColor(isDark: boolean) {
  return isDark ? '#334155' : '#e5e7eb'
}
export function tooltipBg(isDark: boolean) {
  return isDark ? 'rgba(31,41,55,0.96)' : 'rgba(255,255,255,0.96)'
}

export function gradient(colors: [string, string], vertical = true) {
  return new echarts.graphic.LinearGradient(
    0,
    0,
    vertical ? 0 : 1,
    vertical ? 1 : 0,
    [
      { offset: 0, color: colors[0] },
      { offset: 1, color: colors[1] },
    ],
  )
}

export function echartsTheme(isDark: boolean): string | undefined {
  return isDark ? 'dark' : undefined
}

/** 别名对象 */
export const theme = {
  text: textColor,
  subText: subTextColor,
  border: borderColor,
  axisLine: axisLineColor,
  tooltip: tooltipBg,
  gradient,
  echartsTheme,
} as const
