import type { EChartsOption } from 'echarts'

import { SCOPE_LABEL, SCOPE_COLOR } from '~/composables/echarts/constants'
import { subTextColor, borderColor } from '~/composables/echarts/theme'

import type { OrgTrend } from '../api'

export function useOrgDailyTrendOption(data: Ref<OrgTrend>, isDark: Ref<boolean>): Ref<EChartsOption> {
  return computed<EChartsOption>(() => ({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: {
      top: 0,
      right: 0,
      type: 'scroll',
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
      splitLine: {
        lineStyle: {
          color: borderColor(isDark.value),
          type: 'dashed',
          opacity: 0.4,
        },
      },
    },
    series: data.value.series.map((s) => ({
      name: SCOPE_LABEL[s.name] ?? s.name,
      type: 'line',
      stack: 'total',
      smooth: true,
      symbol: 'none',
      areaStyle: { opacity: 0.5 },
      itemStyle: { color: SCOPE_COLOR[s.name] ?? '#94a3b8' },
      lineStyle: { color: SCOPE_COLOR[s.name] ?? '#94a3b8', width: 1.5 },
      data: s.data,
    })),
    animationDuration: 1000,
  }))
}
