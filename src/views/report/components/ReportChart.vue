<template>
  <div ref="chartRef" class="h-full w-full" />
</template>

<script setup lang="ts">
import type { EChartsOption } from 'echarts'

import { BarChart, LineChart, PieChart, ScatterChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TitleComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  CanvasRenderer,
])

defineOptions({ name: 'ReportChart' })

const props = withDefaults(
  defineProps<{
    type: 'line' | 'bar' | 'pie' | 'area' | 'scatter'
    xField: string
    yField: string | string[]
    seriesField?: string
    rows: Record<string, any>[]
    height?: string
  }>(),
  { height: '100%' },
)

const chartRef = ref<HTMLDivElement | null>(null)
const chartInstance = shallowRef<echarts.ECharts | null>(null)

const computedOption = computed<EChartsOption>(() => {
  const { type, xField, yField, rows } = props
  const xData = rows.map((r) => r[xField])
  const yFields = Array.isArray(yField) ? yField : [yField]

  const base: EChartsOption = {
    grid: { top: 32, right: 24, bottom: 32, left: 48, containLabel: true },
    tooltip: {
      trigger: type === 'pie' ? 'item' : 'axis',
      backgroundColor: 'rgba(255,255,255,0.98)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151', fontSize: 12 },
    },
    legend: {
      top: 0,
      right: 0,
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: '#6b7280', fontSize: 12 },
    },
    color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
  }

  if (type === 'pie') {
    return {
      ...base,
      legend: { orient: 'vertical', right: 8, top: 'middle' },
      series: [
        {
          type: 'pie',
          radius: ['48%', '72%'],
          center: ['40%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          labelLine: { show: false },
          data: rows.map((r) => ({
            name: r[xField],
            value: Number(r[yFields[0]!]!) || 0,
          })),
        },
      ],
    }
  }

  const seriesType = type === 'area' ? 'line' : type
  const series: any[] = yFields.map((yf) => ({
    name: yf,
    type: seriesType,
    data: rows.map((r) => Number(r[yf]) || 0),
    smooth: seriesType === 'line',
    symbol: seriesType === 'line' ? 'circle' : undefined,
    symbolSize: 6,
    showSymbol: false,
    itemStyle: seriesType === 'bar' ? { borderRadius: [4, 4, 0, 0] } : undefined,
    lineStyle: seriesType === 'line' ? { width: 2 } : undefined,
    areaStyle: type === 'area' ? { opacity: 0.12 } : undefined,
  }))

  return {
    ...base,
    xAxis: {
      type: 'category',
      data: xData,
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { color: '#6b7280', fontSize: 11 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: '#6b7280', fontSize: 11 },
      splitLine: { lineStyle: { color: '#f3f4f6' } },
    },
    series,
  }
})

function initChart() {
  if (!chartRef.value) return
  chartInstance.value = echarts.init(chartRef.value)
  chartInstance.value.setOption(computedOption.value)
  window.addEventListener('resize', resize)
}

function resize() {
  chartInstance.value?.resize()
}

onMounted(initChart)

watch(computedOption, (opt) => {
  chartInstance.value?.setOption(opt, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  chartInstance.value?.dispose()
  chartInstance.value = null
})
</script>
