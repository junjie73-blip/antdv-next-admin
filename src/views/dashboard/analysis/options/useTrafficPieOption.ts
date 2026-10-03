import type { EChartsOption } from 'echarts'

import { computed, type Ref } from 'vue'

import { PALETTE_LIST } from '~/composables/echarts/constants'
import { subTextColor, textColor } from '~/composables/echarts/theme'

import type { TrafficDistribution } from '../api'

export function useTrafficPieOption(data: Ref<TrafficDistribution[]>, isDark: Ref<boolean>): Ref<EChartsOption> {
  return computed<EChartsOption>(() => ({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: {
      orient: 'vertical',
      right: '2%',
      top: 'center',
      textStyle: { color: subTextColor(isDark.value), fontSize: 12 },
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 14,
      icon: 'circle',
    },
    series: [
      {
        type: 'pie',
        radius: ['42%', '72%'],
        center: ['38%', '50%'],
        padAngle: 2,
        itemStyle: {
          borderRadius: 6,
          borderColor: isDark.value ? '#111827' : '#fff',
          borderWidth: 2,
        },
        label: { show: false },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
            color: textColor(isDark.value),
          },
          scaleSize: 8,
        },
        data: data.value,
        color: [...PALETTE_LIST],
      },
    ],
  }))
}
