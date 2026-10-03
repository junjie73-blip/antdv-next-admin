import type { EChartsOption } from 'echarts'

import { computed, type Ref } from 'vue'

import { SEVERITY_COLOR } from '~/composables/echarts/constants'
import { subTextColor, textColor } from '~/composables/echarts/theme'

import type { RuleDistribution } from '../api'

const SEVERITY_LABEL: Record<string, string> = {
  critical: 'Critical',
  warning: 'Warning',
  info: 'Info',
}

/**
 * 严重级别分布（按 severity 聚合的饼图）
 * 输入 rule-distribution，内存聚合
 */
export function useSeverityBreakdownOption(data: Ref<RuleDistribution[]>, isDark: Ref<boolean>): Ref<EChartsOption> {
  return computed<EChartsOption>(() => {
    // 1. 按 severity 聚合
    const map = new Map<string, number>()
    for (const r of data.value) {
      map.set(r.severity, (map.get(r.severity) ?? 0) + r.count)
    }
    const aggregated = [...map.entries()].map(([severity, count]) => ({
      name: SEVERITY_LABEL[severity] ?? severity,
      value: count,
      itemStyle: { color: SEVERITY_COLOR[severity] ?? '#6b7280' },
    }))

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: {
        bottom: 0,
        textStyle: { color: subTextColor(isDark.value), fontSize: 11 },
      },
      series: [
        {
          type: 'pie',
          radius: ['50%', '75%'],
          center: ['50%', '45%'],
          padAngle: 3,
          itemStyle: { borderRadius: 6 },
          label: {
            show: true,
            formatter: '{b}\n{c}',
            color: textColor(isDark.value),
            fontSize: 11,
            lineHeight: 16,
          },
          labelLine: { length: 10, length2: 6 },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
              color: textColor(isDark.value),
            },
            scaleSize: 8,
          },
          data: aggregated,
        },
      ],
      animationDuration: 1200,
    }
  })
}
