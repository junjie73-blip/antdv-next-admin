import type { EChartsOption } from 'echarts'

import { computed, type Ref } from 'vue'

import { subTextColor } from '~/composables/echarts/theme'

import type { DeptTimeMatrix } from '../api'

export function useDeptTimeHeatmapOption(data: Ref<DeptTimeMatrix>, isDark: Ref<boolean>): Ref<EChartsOption> {
  return computed<EChartsOption>(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      position: 'top',
      formatter: (p: any) => {
        const [x, y, v] = p.data
        return `${data.value.dates[x]}<br/>${data.value.depts[y]}<br/>变更数：<b>${v}</b>`
      },
    },
    grid: { left: 130, right: 30, top: 20, bottom: 70 },
    xAxis: {
      type: 'category',
      data: data.value.dates.map((d) => d.slice(5)),
      splitArea: { show: true },
      axisLabel: {
        rotate: 45,
        fontSize: 10,
        color: subTextColor(isDark.value),
      },
    },
    yAxis: {
      type: 'category',
      data: data.value.depts,
      splitArea: { show: true },
      axisLabel: { fontSize: 11, color: subTextColor(isDark.value) },
    },
    visualMap: {
      min: 0,
      max: data.value.max || 1,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 10,
      inRange: {
        color: isDark.value
          ? ['#0f172a', '#1e3a8a', '#3b82f6', '#93c5fd']
          : ['#f0f9ff', '#7dd3fc', '#0284c7', '#0c4a6e'],
      },
      textStyle: { color: subTextColor(isDark.value), fontSize: 11 },
    },
    series: [
      {
        type: 'heatmap',
        data: data.value.data,
        label: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' },
        },
      },
    ],
  }))
}
