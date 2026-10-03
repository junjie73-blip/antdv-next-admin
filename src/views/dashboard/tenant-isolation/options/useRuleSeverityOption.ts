import type { EChartsOption } from 'echarts'

import { computed, type Ref } from 'vue'

import { PALETTE_LIST } from '~/composables/echarts/constants'
import { subTextColor, textColor } from '~/composables/echarts/theme'

import type { RuleDistribution } from '../api'

export function useRuleSeverityOption(data: Ref<RuleDistribution[]>, isDark: Ref<boolean>): Ref<EChartsOption> {
  return computed<EChartsOption>(() => ({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    legend: {
      type: 'scroll',
      bottom: 0,
      textStyle: { color: subTextColor(isDark.value), fontSize: 10 },
    },
    series: [
      {
        type: 'pie',
        radius: [20, 120],
        center: ['50%', '45%'],
        roseType: 'area',
        itemStyle: {
          borderRadius: 4,
          borderColor: isDark.value ? '#0f172a' : '#fff',
          borderWidth: 1,
        },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 12, fontWeight: 'bold', color: textColor(isDark.value) },
        },
        data: data.value.slice(0, 10).map((r, i) => ({
          name: r.ruleCode,
          value: r.count,
          itemStyle: { color: PALETTE_LIST[i % PALETTE_LIST.length] },
        })),
      },
    ],
  }))
}
