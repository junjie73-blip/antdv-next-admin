import type { EChartsOption } from 'echarts'

import { computed, type Ref } from 'vue'

import { PALETTE } from '~/composables/echarts/constants'
import { subTextColor, borderColor, textColor, gradient } from '~/composables/echarts/theme'

import type { ModuleRankItem } from '../api'

export function useModuleRankOption(data: Ref<ModuleRankItem[]>, isDark: Ref<boolean>): Ref<EChartsOption> {
  return computed<EChartsOption>(() => ({
    backgroundColor: 'transparent',
    grid: {
      left: '2%',
      right: '8%',
      top: '2%',
      bottom: '2%',
      containLabel: true,
    },
    xAxis: {
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
    yAxis: {
      type: 'category',
      data: data.value.map((d) => d.name),
      axisLabel: { color: textColor(isDark.value), fontSize: 12 },
      axisTick: { show: false },
      axisLine: { show: false },
      inverse: true,
    },
    series: [
      {
        type: 'bar',
        data: data.value.map((d) => ({
          value: d.value,
          itemStyle: {
            color: gradient([PALETTE.primary, 'rgba(22,119,255,0.25)'], false),
            borderRadius: [0, 4, 4, 0],
          },
        })),
        barWidth: 16,
        label: {
          show: true,
          position: 'right',
          color: subTextColor(isDark.value),
          fontSize: 11,
          formatter: '{c}',
        },
        animationDuration: 800,
        animationEasing: 'cubicInOut',
      },
    ],
  }))
}
