import type { EChartsOption } from 'echarts'

import { computed, type Ref } from 'vue'

import { PALETTE } from '~/composables/echarts/constants'
import { subTextColor, borderColor, gradient } from '~/composables/echarts/theme'

import type { ErrorRateData } from '../api'

export function useErrorRateOption(data: Ref<ErrorRateData>, isDark: Ref<boolean>): Ref<EChartsOption> {
  return computed<EChartsOption>(() => ({
    backgroundColor: 'transparent',
    legend: {
      data: ['总错误率', '4xx 客户端错误', '5xx 服务端错误'],
      top: 0,
      textStyle: { color: subTextColor(isDark.value), fontSize: 10 },
    },
    grid: {
      left: '3%',
      right: '4%',
      top: '32px',
      bottom: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: data.value.hours,
      axisLabel: { color: subTextColor(isDark.value), fontSize: 9, interval: 2 },
      axisLine: { lineStyle: { color: borderColor(isDark.value) } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      name: '错误率 (%)',
      nameTextStyle: { color: subTextColor(isDark.value), fontSize: 10 },
      axisLabel: {
        color: subTextColor(isDark.value),
        fontSize: 9,
        formatter: '{value}%',
      },
      splitLine: {
        lineStyle: {
          color: borderColor(isDark.value),
          type: 'dashed',
          opacity: 0.4,
        },
      },
    },
    series: [
      {
        name: '总错误率',
        type: 'line',
        data: data.value.errorRates,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: PALETTE.danger, width: 2 },
        areaStyle: {
          color: gradient(['rgba(255,77,79,0.15)', 'rgba(255,77,79,0.01)']),
        },
      },
      {
        name: '4xx 客户端错误',
        type: 'bar',
        data: data.value.errors4xx,
        barWidth: 6,
        itemStyle: { color: PALETTE.warning, borderRadius: [2, 2, 0, 0] },
      },
      {
        name: '5xx 服务端错误',
        type: 'bar',
        data: data.value.errors5xx,
        barWidth: 6,
        itemStyle: { color: PALETTE.danger, borderRadius: [2, 2, 0, 0] },
      },
    ],
    animationDuration: 1200,
  }))
}
