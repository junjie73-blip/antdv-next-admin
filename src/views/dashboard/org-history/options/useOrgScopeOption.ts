import type { EChartsOption } from 'echarts'

import { computed, type Ref } from 'vue'

import { SCOPE_LABEL, PALETTE } from '~/composables/echarts/constants'
import { subTextColor, borderColor } from '~/composables/echarts/theme'

import type { OrgOverview } from '../api'

export function useOrgScopeOption(data: Ref<OrgOverview>, isDark: Ref<boolean>): Ref<EChartsOption> {
  return computed<EChartsOption>(() => {
    const items = data.value.last30dByScope
    const maxVal = Math.max(...items.map((x) => x.count), 10)
    const indicators = items.map((i) => ({
      name: SCOPE_LABEL[i.scope ?? ''] ?? i.scope ?? '其他',
      max: maxVal,
    }))

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item' },
      radar: {
        indicator: indicators,
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
          type: 'radar',
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { color: PALETTE.primary, width: 2 },
          areaStyle: { color: 'rgba(22,119,255,0.2)' },
          itemStyle: { color: PALETTE.primary },
          data: [{ value: items.map((i) => i.count), name: '变更次数' }],
        },
      ],
    }
  })
}
