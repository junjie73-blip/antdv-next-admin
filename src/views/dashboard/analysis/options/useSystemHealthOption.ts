import type { EChartsOption } from 'echarts'

import { computed, type Ref } from 'vue'

import { PALETTE } from '~/composables/echarts/constants'
import { subTextColor, textColor } from '~/composables/echarts/theme'

import type { SystemHealth } from '../api'

export function useSystemHealthOption(data: Ref<SystemHealth>, isDark: Ref<boolean>): Ref<EChartsOption> {
  return computed<EChartsOption>(() => ({
    backgroundColor: 'transparent',
    series: [
      {
        type: 'gauge',
        startAngle: 210,
        endAngle: -30,
        radius: '92%',
        min: 0,
        max: 100,
        axisLine: {
          lineStyle: {
            width: 14,
            color: [
              [0.35, PALETTE.danger],
              [0.65, PALETTE.warning],
              [1, PALETTE.success],
            ],
          },
        },
        pointer: { length: '58%', width: 4, itemStyle: { color: 'auto' } },
        axisTick: { length: 6, lineStyle: { color: 'auto', width: 1.5 } },
        splitLine: { length: 12, lineStyle: { color: 'auto', width: 2 } },
        axisLabel: {
          color: subTextColor(isDark.value),
          distance: 18,
          fontSize: 10,
        },
        detail: {
          valueAnimation: true,
          formatter: '{value}%',
          color: textColor(isDark.value),
          fontSize: 26,
          fontWeight: 700,
          offsetCenter: [0, '55%'],
        },
        title: { show: false },
        data: [{ value: data.value.health ?? 0 }],
        animationDuration: 1800,
      },
    ],
  }))
}
