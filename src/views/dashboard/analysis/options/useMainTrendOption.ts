import type { EChartsOption } from 'echarts'

import { computed, type Ref } from 'vue'

import { PALETTE } from '~/composables/echarts/constants'
import { subTextColor, axisLineColor, borderColor, gradient } from '~/composables/echarts/theme'

import type { ActivityTrendData } from '../api'

export function useMainTrendOption(data: Ref<ActivityTrendData>, isDark: Ref<boolean>): Ref<EChartsOption> {
  return computed<EChartsOption>(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', crossStyle: { color: '#999' } },
    },
    legend: {
      data: ['页面访问(PV)', '独立访客(UV)', 'API调用'],
      top: 0,
      right: 0,
      textStyle: { color: subTextColor(isDark.value), fontSize: 12 },
    },
    grid: {
      left: '3%',
      right: '4%',
      top: '36px',
      bottom: '8%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: data.value.categories,
      boundaryGap: false,
      axisLine: { lineStyle: { color: axisLineColor(isDark.value) } },
      axisLabel: { color: subTextColor(isDark.value), fontSize: 11 },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        name: '访问量',
        nameTextStyle: { color: subTextColor(isDark.value), fontSize: 11 },
        axisLabel: { color: subTextColor(isDark.value), fontSize: 11 },
        splitLine: {
          lineStyle: {
            color: borderColor(isDark.value),
            type: 'dashed',
            opacity: 0.5,
          },
        },
      },
      {
        type: 'value',
        name: 'API',
        nameTextStyle: { color: subTextColor(isDark.value), fontSize: 11 },
        axisLabel: {
          color: subTextColor(isDark.value),
          fontSize: 11,
          formatter: (v: number) => `${v / 1000}k`,
        },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '页面访问(PV)',
        type: 'line',
        data: data.value.pv,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: PALETTE.primary, width: 2.5 },
        areaStyle: {
          color: gradient(['rgba(22,119,255,0.18)', 'rgba(22,119,255,0.01)']),
        },
      },
      {
        name: '独立访客(UV)',
        type: 'line',
        data: data.value.uv,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: PALETTE.success, width: 2 },
        areaStyle: {
          color: gradient(['rgba(82,196,26,0.12)', 'rgba(82,196,26,0.01)']),
        },
      },
      {
        name: 'API调用',
        type: 'bar',
        yAxisIndex: 1,
        data: data.value.apiCalls,
        barWidth: 10,
        barGap: '-100%',
        itemStyle: {
          borderRadius: [3, 3, 0, 0],
          color: gradient(['rgba(114,46,209,0.6)', 'rgba(114,46,209,0.08)']),
        },
      },
    ],
    animationDuration: 1200,
  }))
}
