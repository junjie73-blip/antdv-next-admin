<template>
  <div class="h-full rounded-xl border border-gray-200/70 bg-white p-4">
    <div class="mb-3 flex items-center justify-between">
      <h3 class="text-sm font-semibold text-slate-700">近 7 天趋势</h3>
      <div class="flex items-center gap-3 text-[11px] text-slate-500">
        <span class="flex items-center gap-1">
          <span class="h-2 w-2 rounded-full bg-blue-500" />
          总数
        </span>
        <span class="flex items-center gap-1">
          <span class="h-2 w-2 rounded-full bg-emerald-500" />
          成功
        </span>
        <span class="flex items-center gap-1">
          <span class="h-2 w-2 rounded-full bg-rose-500" />
          失败
        </span>
      </div>
    </div>

    <a-spin :spinning="loading">
      <div ref="chartRef" class="h-56" />
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import type { EChartsOption } from 'echarts'

import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

import type { ExportTrendItem } from '../types'

echarts.use([BarChart, LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

defineOptions({ name: 'ExportTrendChart' })

const props = defineProps<{
  data: ExportTrendItem[]
  loading?: boolean
}>()

const chartRef = ref<HTMLDivElement | null>(null)
const chartInstance = shallowRef<echarts.ECharts | null>(null)

function buildOption(): EChartsOption {
  const dates = props.data.map((d) => d.date.slice(5)) // MM-DD
  const totals = props.data.map((d) => d.total)
  const completed = props.data.map((d) => d.completed)
  const failed = props.data.map((d) => d.failed)

  return {
    grid: { top: 20, right: 16, bottom: 28, left: 40, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.98)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151', fontSize: 12 },
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      splitLine: { lineStyle: { color: '#f3f4f6' } },
    },
    series: [
      {
        name: '总数',
        type: 'bar',
        data: totals,
        barWidth: 18,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: 'rgba(59, 130, 246, 0.6)',
        },
      },
      {
        name: '成功',
        type: 'line',
        data: completed,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color: '#10b981' },
        itemStyle: { color: '#10b981' },
      },
      {
        name: '失败',
        type: 'line',
        data: failed,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color: '#ef4444' },
        itemStyle: { color: '#ef4444' },
      },
    ],
  }
}

function initChart() {
  if (!chartRef.value) return
  chartInstance.value = echarts.init(chartRef.value)
  chartInstance.value.setOption(buildOption())
  window.addEventListener('resize', resize)
}

function resize() {
  chartInstance.value?.resize()
}

onMounted(initChart)

watch(
  () => props.data,
  () => {
    chartInstance.value?.setOption(buildOption(), true)
  },
  { deep: true },
)

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  chartInstance.value?.dispose()
})
</script>
