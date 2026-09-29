<script setup lang="ts">
import { Icon } from '@iconify/vue'
import 'echarts-wordcloud'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import ECharts from '~/components/common/ECharts/index.vue'

import { getQpsHistory, getQpsSummary } from './api'

defineOptions({ name: 'MonitorQps' })

const summary = ref<any>(null)
const endpoints = ref<any[]>([])
const statusDist = ref<any[]>([])
const methodDist = ref<any[]>([])
const history = ref<{ timestamp: number; qps: number }[]>([])
let timer: ReturnType<typeof setInterval> | null = null

async function load() {
  const [sumRes, hisRes]: any[] = await Promise.all([getQpsSummary(300), getQpsHistory(5)])
  const sum = sumRes?.data ?? sumRes
  summary.value = sum.summary
  endpoints.value = sum.endpoints ?? []
  statusDist.value = sum.statusDistribution ?? []
  methodDist.value = sum.methodDistribution ?? []
  history.value = hisRes?.data ?? hisRes ?? []
}

onMounted(async () => {
  await load()
  timer = setInterval(load, 5000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

/* ============================================================
 * QPS 曲线
 * ============================================================ */
const timelineOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 50, right: 30, top: 20, bottom: 30 },
  xAxis: {
    type: 'category',
    data: history.value.map((p) => {
      const d = new Date(p.timestamp)
      return `${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
    }),
    boundaryGap: false,
  },
  yAxis: { type: 'value', name: 'QPS' },
  series: [
    {
      type: 'line',
      smooth: true,
      data: history.value.map((p) => p.qps),
      areaStyle: { opacity: 0.2 },
      itemStyle: { color: '#3b82f6' },
    },
  ],
}))

/* ============================================================
 * 词云：最热接口
 * ============================================================ */
const wordcloudOption = computed(() => ({
  tooltip: {
    formatter: (p: any) => `${p.name}<br/>调用 ${p.value} 次`,
  },
  series: [
    {
      type: 'wordCloud',
      shape: 'circle',
      left: 'center',
      top: 'center',
      width: '95%',
      height: '95%',
      sizeRange: [12, 40],
      rotationRange: [-45, 45],
      rotationStep: 45,
      gridSize: 8,
      drawOutOfBound: false,
      textStyle: {
        fontFamily: 'sans-serif',
        fontWeight: 'bold',
        color: () => {
          const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']
          return colors[Math.floor(Math.random() * colors.length)]
        },
      },
      data: endpoints.value.slice(0, 50).map((e) => ({
        name: e.endpoint,
        value: e.count,
      })),
    },
  ],
}))

/* ============================================================
 * 状态码分布饼图
 * ============================================================ */
const statusPieOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
  legend: { bottom: 0 },
  series: [
    {
      type: 'pie',
      radius: ['45%', '70%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      data: statusDist.value.map((s) => ({
        name: s.status,
        value: s.count,
        itemStyle: {
          color: s.status.startsWith('2')
            ? '#10b981'
            : s.status.startsWith('3')
              ? '#3b82f6'
              : s.status.startsWith('4')
                ? '#f59e0b'
                : '#ef4444',
        },
      })),
    },
  ],
}))

/* ============================================================
 * 方法分布饼图
 * ============================================================ */
const methodPieOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
  legend: { bottom: 0 },
  series: [
    {
      type: 'pie',
      radius: ['45%', '70%'],
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      data: methodDist.value.map((m) => ({
        name: m.method,
        value: m.count,
      })),
    },
  ],
}))
const columns = [
  { dataIndex: 'method', title: '方法', align: 'center' },
  { dataIndex: 'endpoint', title: '接口', ellipsis: true },
  { dataIndex: 'count', title: '调用次数', align: 'right', width: '120px' },
  { dataIndex: 'avgTime', title: '平均耗时(ms)', align: 'right', width: '140px' },
]
</script>

<template>
  <PerfectScrollbar class="h-full">
    <div class="space-y-4 p-4">
      <!-- 概览 -->
      <div v-if="summary" class="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div class="rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div class="mb-2 flex items-center gap-2 text-xs text-slate-500"><Icon icon="carbon:flash" /> 当前 QPS</div>
          <div class="text-2xl font-semibold text-blue-500">
            {{ summary.currentQps }}
          </div>
        </div>
        <div class="rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div class="mb-2 flex items-center gap-2 text-xs text-slate-500">
            <Icon icon="carbon:chart-line" /> 总请求数
          </div>
          <div class="text-2xl font-semibold">{{ summary.totalRequests }}</div>
        </div>
        <div class="rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div class="mb-2 flex items-center gap-2 text-xs text-slate-500"><Icon icon="carbon:timer" /> 平均响应</div>
          <div class="text-2xl font-semibold text-emerald-500">
            {{ summary.avgResponseTime }}<span class="ml-0.5 text-xs">ms</span>
          </div>
        </div>
        <div class="rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div class="mb-2 flex items-center gap-2 text-xs text-slate-500">
            <Icon icon="carbon:warning-alt" /> 错误率
          </div>
          <div
            class="text-2xl font-semibold"
            :class="summary.errorRate > 5 ? 'text-rose-500' : 'text-slate-700 dark:text-slate-200'"
          >
            {{ summary.errorRate }}<span class="ml-0.5 text-xs">%</span>
          </div>
        </div>
        <div class="rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div class="mb-2 flex items-center gap-2 text-xs text-slate-500"><Icon icon="carbon:api" /> 接口数</div>
          <div class="text-2xl font-semibold">{{ endpoints.length }}</div>
        </div>
      </div>

      <!-- QPS 曲线 -->
      <a-card title="QPS 实时曲线（最近 5 分钟）" :bordered="false" class="shadow-sm">
        <ECharts :option="timelineOption" height="280px" />
      </a-card>

      <!-- 词云 + 饼图 -->
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <a-card title="最热接口（词云）" :bordered="false" class="shadow-sm lg:col-span-2">
          <ECharts :option="wordcloudOption" height="360px" />
        </a-card>
        <div class="space-y-4">
          <a-card title="状态码分布" :bordered="false" class="shadow-sm">
            <ECharts :option="statusPieOption" height="170px" />
          </a-card>
          <a-card title="请求方法分布" :bordered="false" class="shadow-sm">
            <ECharts :option="methodPieOption" height="170px" />
          </a-card>
        </div>
      </div>

      <!-- 接口明细 -->
      <a-card title="接口统计 Top 30" :bordered="false" class="shadow-sm">
        <a-table :data-source="endpoints" :pagination="false" size="small" row-key="endpoint" :columns>
          <template #body-cell="{ record }">
            <a-tag
              :color="
                record.method === 'GET'
                  ? 'blue'
                  : record.method === 'POST'
                    ? 'green'
                    : record.method === 'PUT'
                      ? 'orange'
                      : record.method === 'DELETE'
                        ? 'red'
                        : 'default'
              "
            >
              {{ record.method }}
            </a-tag>
          </template>
        </a-table>
      </a-card>
    </div>
  </PerfectScrollbar>
</template>
