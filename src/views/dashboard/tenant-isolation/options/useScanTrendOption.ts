import type { EChartsOption } from 'echarts'

import { computed, type Ref } from 'vue'

import { PALETTE } from '~/composables/echarts/constants'
import { subTextColor, borderColor, gradient } from '~/composables/echarts/theme'

import type { IsolationTrend } from '../api'

export function useScanTrendOption(data: Ref<IsolationTrend>, isDark: Ref<boolean>): Ref<EChartsOption> {
  return computed<EChartsOption>(() => ({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: {
      data: ['新增', '修复', 'Critical', 'Warning'],
      top: 0,
      right: 0,
      textStyle: { color: subTextColor(isDark.value), fontSize: 11 },
    },
    grid: { left: 40, right: 20, top: 40, bottom: 30 },
    xAxis: {
      type: 'category',
      data: data.value.dates.map((d) => d.slice(5)),
      axisLabel: { color: subTextColor(isDark.value), fontSize: 10 },
      axisLine: { lineStyle: { color: borderColor(isDark.value) } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: subTextColor(isDark.value), fontSize: 10 },
      splitLine: { lineStyle: { color: borderColor(isDark.value), type: 'dashed', opacity: 0.4 } },
    },
    series: [
      {
        name: '新增',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: data.value.newCounts,
        lineStyle: { color: PALETTE.danger, width: 2 },
        areaStyle: { color: gradient(['rgba(255,77,79,0.2)', 'rgba(255,77,79,0.01)']) },
      },
      {
        name: '修复',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: data.value.resolvedCounts,
        lineStyle: { color: PALETTE.success, width: 2 },
        areaStyle: { color: gradient(['rgba(82,196,26,0.18)', 'rgba(82,196,26,0.01)']) },
      },
      {
        name: 'Critical',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: data.value.criticalSeries,
        lineStyle: { color: '#dc2626', width: 1.5, type: 'dashed' },
      },
      {
        name: 'Warning',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: data.value.warningSeries,
        lineStyle: { color: PALETTE.warning, width: 1.5, type: 'dashed' },
      },
    ],
    animationDuration: 1200,
  }))
}
