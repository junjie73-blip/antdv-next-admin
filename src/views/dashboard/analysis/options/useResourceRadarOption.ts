import type { EChartsOption } from 'echarts'

import { computed, type Ref } from 'vue'

import { PALETTE } from '~/composables/echarts/constants'
import { subTextColor, borderColor } from '~/composables/echarts/theme'

import type { ResourceUsageData } from '../api'

export function useResourceRadarOption(data: Ref<ResourceUsageData>, isDark: Ref<boolean>): Ref<EChartsOption> {
  return computed<EChartsOption>(() => ({
    backgroundColor: 'transparent',
    legend: {
      data: ['当前', '峰值'],
      bottom: 0,
      textStyle: { color: subTextColor(isDark.value), fontSize: 12 },
    },
    radar: {
      indicator: data.value.indicators,
      axisName: { color: subTextColor(isDark.value), fontSize: 11 },
      splitArea: {
        areaStyle: {
          color: isDark.value
            ? ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)']
            : ['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.04)'],
        },
      },
      splitLine: {
        lineStyle: { color: borderColor(isDark.value), opacity: 0.4 },
      },
      axisLine: {
        lineStyle: { color: borderColor(isDark.value), opacity: 0.4 },
      },
    },
    series: [
      {
        name: '当前',
        type: 'radar',
        data: [{ value: data.value.current, name: '当前' }],
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: PALETTE.primary, width: 2 },
        areaStyle: { color: 'rgba(22,119,255,0.18)' },
        itemStyle: { color: PALETTE.primary },
      },
      {
        name: '峰值',
        type: 'radar',
        data: [{ value: data.value.peak, name: '峰值' }],
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { color: PALETTE.danger, width: 1.5, type: 'dashed' },
        areaStyle: { color: 'rgba(255,77,79,0.06)' },
        itemStyle: { color: PALETTE.danger },
      },
    ],
  }))
}
