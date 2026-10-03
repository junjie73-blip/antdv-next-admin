import type { EChartsOption } from 'echarts'

import { computed, type Ref } from 'vue'

import { subTextColor, textColor } from '~/composables/echarts/theme'

import type { RuleDistribution } from '../api'

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#dc2626',
  warning: '#f59e0b',
  info: '#3b82f6',
}

export function useRuleDistributionOption(data: Ref<RuleDistribution[]>, isDark: Ref<boolean>): Ref<EChartsOption> {
  return computed<EChartsOption>(() => ({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: {
      bottom: 0,
      type: 'scroll',
      textStyle: { color: subTextColor(isDark.value), fontSize: 11 },
    },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '45%'],
        padAngle: 2,
        itemStyle: { borderRadius: 6 },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 13, fontWeight: 'bold', color: textColor(isDark.value) },
        },
        data: data.value.map((r) => ({
          name: r.ruleCode,
          value: r.count,
          itemStyle: { color: SEVERITY_COLOR[r.severity] ?? '#6b7280' },
        })),
      },
    ],
  }))
}
