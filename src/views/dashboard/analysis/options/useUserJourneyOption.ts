import type { EChartsOption } from 'echarts'

import { computed, type Ref } from 'vue'

import { PALETTE } from '~/composables/echarts/constants'

import type { JourneyStage } from '../api'

export function useUserJourneyOption(data: Ref<JourneyStage[]>, isDark: Ref<boolean>): Ref<EChartsOption> {
  return computed<EChartsOption>(() => {
    const total = data.value[0]?.value ?? 1
    return {
      backgroundColor: 'transparent',
      tooltip: {
        formatter: (params: any) =>
          `<b>${params.name}</b><br/>人数: ${params.value}<br/>转化率: ${((params.value / total) * 100).toFixed(1)}%`,
      },
      series: [
        {
          type: 'funnel',
          left: '12%',
          top: 16,
          bottom: 16,
          width: '76%',
          sort: 'descending',
          gap: 3,
          label: {
            show: true,
            position: 'inside',
            formatter: '{b}\n{c}',
            color: '#fff',
            fontSize: 12,
            fontWeight: 500,
          },
          labelLine: { show: false },
          itemStyle: {
            borderColor: isDark.value ? '#111827' : '#fff',
            borderWidth: 2,
            shadowBlur: 8,
            shadowColor: 'rgba(0,0,0,0.08)',
          },
          data: data.value,
          color: [PALETTE.primary, '#4096ff', '#69b1ff', '#91caff', '#bae0fe'],
          animationDuration: 1500,
        },
      ],
    }
  })
}
