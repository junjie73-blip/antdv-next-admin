import type { EChartsOption } from 'echarts'

import { computed, type Ref } from 'vue'

import { subTextColor, borderColor } from '~/composables/echarts/theme'

import type { DeptTransferHeat } from '../api'

export function useDeptTransferOption(data: Ref<DeptTransferHeat[]>, isDark: Ref<boolean>): Ref<EChartsOption> {
  return computed<EChartsOption>(() => ({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: {
      top: 0,
      textStyle: { color: subTextColor(isDark.value), fontSize: 11 },
    },
    grid: { left: 130, right: 40, top: 30, bottom: 20 },
    xAxis: {
      type: 'value',
      axisLabel: { color: subTextColor(isDark.value), fontSize: 10 },
      splitLine: {
        lineStyle: {
          color: borderColor(isDark.value),
          type: 'dashed',
          opacity: 0.4,
        },
      },
    },
    yAxis: {
      type: 'category',
      data: data.value.map((h) => h.deptName).reverse(),
      axisLabel: { fontSize: 11, color: subTextColor(isDark.value) },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: '加入',
        type: 'bar',
        stack: 'total',
        itemStyle: { color: '#10b981' },
        data: data.value.map((h) => h.inCount).reverse(),
        label: {
          show: true,
          position: 'insideRight',
          color: '#fff',
          fontSize: 10,
        },
      },
      {
        name: '移出',
        type: 'bar',
        stack: 'total',
        itemStyle: { color: '#f43f5e', borderRadius: [0, 4, 4, 0] },
        data: data.value.map((h) => h.outCount).reverse(),
        label: {
          show: true,
          position: 'insideRight',
          color: '#fff',
          fontSize: 10,
        },
      },
    ],
  }))
}
