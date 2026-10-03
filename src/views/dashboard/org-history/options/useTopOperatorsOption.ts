import type { EChartsOption } from 'echarts'

import { PALETTE_LIST } from '~/composables/echarts/constants'
import { subTextColor, textColor } from '~/composables/echarts/theme'

import type { TopOperator } from '../api'

export function useTopOperatorsOption(data: Ref<TopOperator[]>, isDark: Ref<boolean>): Ref<EChartsOption> {
  return computed<EChartsOption>(() => ({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: {
      type: 'scroll',
      bottom: 0,
      textStyle: { color: subTextColor(isDark.value), fontSize: 10 },
    },
    series: [
      {
        type: 'pie',
        radius: ['30%', '72%'],
        center: ['50%', '45%'],
        roseType: 'radius',
        padAngle: 2,
        itemStyle: {
          borderRadius: 6,
          borderColor: isDark.value ? '#0f172a' : '#fff',
          borderWidth: 2,
        },
        label: { show: false },
        emphasis: {
          label: {
            show: true,
            fontSize: 13,
            fontWeight: 'bold',
            color: textColor(isDark.value),
          },
          scaleSize: 8,
        },
        data: data.value.map((o, i) => ({
          name: o.operator_name,
          value: o.count,
          itemStyle: { color: PALETTE_LIST[i % PALETTE_LIST.length] },
        })),
      },
    ],
  }))
}
