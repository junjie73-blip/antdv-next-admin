<template>
  <div class="h-full rounded-xl border border-gray-200/70 bg-white p-4">
    <div class="mb-3 flex items-center justify-between">
      <h3 class="text-sm font-semibold text-slate-700">状态分布</h3>
      <span class="text-[11px] text-slate-400">实时</span>
    </div>

    <a-spin :spinning="loading">
      <div ref="chartRef" class="h-56" />
      <div class="mt-3 space-y-1.5">
        <div v-for="item in legendItems" :key="item.key" class="flex items-center justify-between text-xs">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full" :style="{ background: item.color }" />
            <span class="text-slate-600">{{ item.label }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="font-medium text-slate-800 tabular-nums">
              {{ item.value }}
            </span>
            <span class="text-slate-400 tabular-nums"> {{ item.percent }}% </span>
          </div>
        </div>
      </div>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import type { EChartsOption } from 'echarts'

import { PieChart } from 'echarts/charts'
import { LegendComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

import type { ExportStats } from '../types'

echarts.use([PieChart, LegendComponent, TooltipComponent, CanvasRenderer])

defineOptions({ name: 'ExportStatusPie' })

const props = defineProps<{
  stats: ExportStats
  loading?: boolean
}>()

const chartRef = ref<HTMLDivElement | null>(null)
const chartInstance = shallowRef<echarts.ECharts | null>(null)

const COLORS = {
  processing: '#3b82f6',
  pending: '#f59e0b',
  completed: '#10b981',
  failed: '#ef4444',
  cancelled: '#94a3b8',
}

const pieData = computed(() => {
  const s = props.stats
  return [
    { name: '生成中', value: s.processing, itemStyle: { color: COLORS.processing } },
    { name: '排队中', value: s.pending - s.retrying, itemStyle: { color: COLORS.pending } },
    { name: '待重试', value: s.retrying, itemStyle: { color: '#fb923c' } },
    { name: '已完成', value: s.completed, itemStyle: { color: COLORS.completed } },
    { name: '失败', value: s.failed, itemStyle: { color: COLORS.failed } },
    { name: '已取消', value: s.cancelled, itemStyle: { color: COLORS.cancelled } },
  ].filter((d) => d.value > 0)
})

const legendItems = computed(() => {
  const total = pieData.value.reduce((sum, d) => sum + d.value, 0)
  return pieData.value.map((d) => ({
    key: d.name,
    label: d.name,
    value: d.value,
    color: d.itemStyle.color,
    percent: total > 0 ? ((d.value / total) * 100).toFixed(1) : '0.0',
  }))
})

function buildOption(): EChartsOption {
  return {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
      backgroundColor: 'rgba(255,255,255,0.98)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151', fontSize: 12 },
    },
    series: [
      {
        type: 'pie',
        radius: ['58%', '80%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: { show: false },
        labelLine: { show: false },
        data:
          pieData.value.length > 0 ? pieData.value : [{ name: '暂无数据', value: 1, itemStyle: { color: '#f1f5f9' } }],
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
  () => props.stats,
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
