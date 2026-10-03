import type { EChartsOption } from 'echarts'

import { computed, type Ref } from 'vue'

import { PALETTE } from '~/composables/echarts/constants'
import { subTextColor, borderColor, textColor, gradient } from '~/composables/echarts/theme'

import type { TableHeat } from '../api'

export function useTableHeatmapOption(data: Ref<TableHeat[]>, isDark: Ref<boolean>): Ref<EChartsOption> {
  return computed<EChartsOption>(() => ({
    backgroundColor: 'transparent',
    grid: { left: 120, right: 60, top: 10, bottom: 20 },
    xAxis: {
      type: 'value',
      axisLabel: { color: subTextColor(isDark.value), fontSize: 10 },
      splitLine: { lineStyle: { color: borderColor(isDark.value), type: 'dashed', opacity: 0.4 } },
    },
    yAxis: {
      type: 'category',
      data: data.value.map((h) => h.tableName).reverse(),
      axisLabel: { color: textColor(isDark.value), fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: data.value.map((h) => h.issueCount).reverse(),
        barWidth: 16,
        itemStyle: {
          color: gradient([PALETTE.danger, 'rgba(255,77,79,0.25)'], false),
          borderRadius: [0, 4, 4, 0],
        },
        label: { show: true, position: 'right', color: subTextColor(isDark.value), fontSize: 11 },
      },
    ],
  }))
}
