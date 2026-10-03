import type { EChartsOption } from 'echarts'

import { computed, type Ref } from 'vue'

import { PALETTE_LIST } from '~/composables/echarts/constants'
import { textColor } from '~/composables/echarts/theme'

import type { ApiFlowData } from '../api'

export function useApiSankeyOption(data: Ref<ApiFlowData>, isDark: Ref<boolean>): Ref<EChartsOption> {
  return computed<EChartsOption>(() => ({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', triggerOn: 'mousemove' },
    series: [
      {
        type: 'sankey',
        left: 20,
        right: 20,
        top: 20,
        bottom: 20,
        nodeWidth: 20,
        nodeGap: 12,
        draggable: false,
        emphasis: { focus: 'adjacency' },
        lineStyle: { color: 'gradient', curveness: 0.5, opacity: 0.35 },
        label: { color: textColor(isDark.value), fontSize: 11 },
        data: data.value.nodes,
        links: data.value.links,
        color: [...PALETTE_LIST],
      },
    ],
  }))
}
