import type { EChartsOption } from 'echarts'

import { computed, type Ref } from 'vue'

import { PALETTE_LIST } from '~/composables/echarts/constants'
import { subTextColor, textColor } from '~/composables/echarts/theme'

const CHANGE_LABEL: Record<string, string> = {
  create: '创建',
  update: '更新',
  delete: '删除',
  move: '移动',
  transfer: '调动',
  assign: '分配',
  revoke: '移除',
}

export function useChangeTypeOption(
  changeCounts: Ref<Record<string, number>>,
  isDark: Ref<boolean>,
): Ref<EChartsOption> {
  return computed<EChartsOption>(() => ({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: '{b}: {c}' },
    legend: {
      bottom: 0,
      textStyle: { color: subTextColor(isDark.value), fontSize: 11 },
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '68%'],
        center: ['50%', '45%'],
        padAngle: 3,
        itemStyle: { borderRadius: 6 },
        label: { show: false },
        emphasis: {
          label: {
            show: true,
            fontSize: 13,
            fontWeight: 'bold',
            color: textColor(isDark.value),
          },
        },
        data: Object.entries(changeCounts.value).map(([k, v], i) => ({
          name: CHANGE_LABEL[k] ?? k,
          value: v,
          itemStyle: { color: PALETTE_LIST[i % PALETTE_LIST.length] },
        })),
      },
    ],
  }))
}
