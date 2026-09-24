import * as echarts from 'echarts'

import { getUserJourney } from '~/api'

import type { JourneyStage } from '../types'

import { PALETTE } from '../constants'
import { baseOption, echartsTheme } from '../theme'

/** 用户行为漏斗 */
export async function initUserJourney<T = any>(el: HTMLElement, isDark: boolean): Promise<echarts.ECharts> {
  const instance = echarts.init(el, echartsTheme(isDark))

  let stages: JourneyStage[] = []
  try {
    const res = await getUserJourney()
    stages = res?.data ?? res ?? []
  } catch (e) {
    console.warn('加载用户行为失败', e)
  }

  const total = stages[0]?.value ?? 1

  instance.setOption(
    baseOption(isDark, {
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
            borderColor: isDark ? '#111827' : '#fff',
            borderWidth: 2,
            shadowBlur: 8,
            shadowColor: 'rgba(0,0,0,0.08)',
          },
          data: stages,
          color: [PALETTE.primary, '#4096ff', '#69b1ff', '#91caff', '#bae0fe'],
          animationDuration: 1500,
        },
      ],
    }),
  )

  return instance
}
