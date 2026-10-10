import type { LinearGradientObject } from 'echarts';

import * as echarts from 'echarts/core';

export function textColor(isDark: boolean) {
  return isDark ? '#cbd5e1' : '#64748b';
}
export function subTextColor(isDark: boolean) {
  return isDark ? '#6b7280' : '#9ca3af';
}
export function borderColor(isDark: boolean) {
  return isDark ? '#374151' : '#e5e7eb';
}
export function axisLineColor(isDark: boolean) {
  return isDark ? '#334155' : '#e5e7eb';
}
export function tooltipBg(isDark: boolean) {
  return isDark ? 'rgba(31,41,55,0.96)' : 'rgba(255,255,255,0.96)';
}

/**
 * 线性渐变色。
 *
 * 返回值显式标成 `LinearGradientObject` 而不是让 TS 去推 `echarts.graphic.LinearGradient`：
 * 后者的 `colorStops` 用的是 echarts 内部没有导出的 `GradientColorStop`，
 * 生成 .d.ts 时会报 TS4058（Return type ... cannot be named）。
 * 而且调用方拿到的是 option 里能直接写的对象类型，比类类型更好用。
 */
export function gradient(
  colors: [string, string],
  vertical = true,
): LinearGradientObject {
  return new echarts.graphic.LinearGradient(
    0,
    0,
    vertical ? 0 : 1,
    vertical ? 1 : 0,
    [
      { offset: 0, color: colors[0] },
      { offset: 1, color: colors[1] },
    ],
  );
}

export function echartsTheme(isDark: boolean): string | undefined {
  return isDark ? 'dark' : undefined;
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
} as const;
