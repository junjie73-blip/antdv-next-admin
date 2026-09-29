<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref } from 'vue'

import ECharts from '~/components/common/ECharts/index.vue'

import { getDbInfo, getIndexStats, getSlowQueries, getTableStats } from './api'

defineOptions({ name: 'MonitorDatabase' })

const activeTab = ref('overview')
const info = ref<any>(null)
const slowQueries = ref<any[]>([])
const tables = ref<any[]>([])
const indexes = ref<any[]>([])
const loading = ref(false)

async function loadAll() {
  loading.value = true
  try {
    const [a, b, c, d]: any[] = await Promise.all([
      getDbInfo(),
      getSlowQueries(20),
      getTableStats(30),
      getIndexStats(20),
    ])
    info.value = a?.data ?? a
    slowQueries.value = b?.data ?? b ?? []
    tables.value = c?.data ?? c ?? []
    indexes.value = d?.data ?? d ?? []
  } finally {
    loading.value = false
  }
}

onMounted(loadAll)

/* ============================================================
 * 表大小 Top 10 柱状图
 * ============================================================ */
const tableSizeOption = computed(() => {
  const top = tables.value.slice(0, 10).reverse()
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const p = params[0]
        return `${p.name}<br/>${p.value}`
      },
    },
    grid: { left: 120, right: 30, top: 20, bottom: 30 },
    xAxis: {
      type: 'value',
      axisLabel: { formatter: (v: number) => `${(v / 1024 / 1024).toFixed(1)} MB` },
    },
    yAxis: {
      type: 'category',
      data: top.map((t) => t.name),
      axisLabel: { fontSize: 11 },
    },
    series: [
      {
        type: 'bar',
        data: top.map((t) => t.totalSizeBytes),
        itemStyle: {
          color: '#3b82f6',
          borderRadius: [0, 4, 4, 0],
        },
      },
    ],
  }
})

/* ============================================================
 * 慢查询耗时 Top 10
 * ============================================================ */
const slowQueryOption = computed(() => {
  const top = slowQueries.value.slice(0, 10).reverse()
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 60, right: 30, top: 20, bottom: 30 },
    xAxis: {
      type: 'value',
      axisLabel: { formatter: '{value} ms' },
    },
    yAxis: {
      type: 'category',
      data: top.map((q, i) => `#${i + 1}`),
    },
    series: [
      {
        type: 'bar',
        data: top.map((q) => q.meanTime),
        itemStyle: { color: '#ef4444', borderRadius: [0, 4, 4, 0] },
      },
    ],
  }
})

/* ============================================================
 * 索引使用 Top 10
 * ============================================================ */
const indexUsageOption = computed(() => {
  const top = indexes.value.slice(0, 10).reverse()
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 180, right: 30, top: 20, bottom: 30 },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: top.map((i) => i.index),
      axisLabel: { fontSize: 11, width: 160, overflow: 'truncate' },
    },
    series: [
      {
        type: 'bar',
        data: top.map((i) => i.idxScan),
        itemStyle: { color: '#10b981', borderRadius: [0, 4, 4, 0] },
      },
    ],
  }
})
const columns = [
  {
    title: '表名',
    dataIndex: 'name',
    width: '20%',
    ellipsis: true,
    fixed: 'left',
  },
  {
    title: '行数',
    dataIndex: 'liveRows',
    align: 'center',
  },
  {
    title: '死行',
    dataIndex: 'deadRows',
    align: 'center',
  },
  {
    title: '总大小',
    dataIndex: 'totalSize',
    align: 'center',
  },
  {
    title: '索引大小',
    dataIndex: 'indexSize',
    align: 'center',
  },
  {
    title: '顺序扫描',
    dataIndex: 'seqScan',
    align: 'center',
  },
  {
    title: '索引扫描',
    dataIndex: 'idxScan',
    align: 'center',
  },
]
</script>

<template>
  <div class="space-y-4 p-4">
    <!-- 概览 -->
    <div v-if="info" class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div class="rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div class="mb-2 flex items-center gap-2 text-xs text-slate-500"><Icon icon="carbon:data-base" /> 数据库</div>
        <div class="text-lg font-semibold">{{ info.database }}</div>
        <div class="mt-1 text-xs text-slate-400">{{ info.version }}</div>
      </div>
      <div class="rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div class="mb-2 flex items-center gap-2 text-xs text-slate-500">
          <Icon icon="carbon:chart-line-data" /> 数据量
        </div>
        <div class="text-lg font-semibold">{{ info.size }}</div>
        <div class="mt-1 text-xs text-slate-400">运行 {{ info.uptime }}</div>
      </div>
      <div class="rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div class="mb-2 flex items-center gap-2 text-xs text-slate-500"><Icon icon="carbon:network-4" /> 连接</div>
        <div class="text-lg font-semibold">{{ info.connections.total }} / {{ info.connections.max }}</div>
        <div class="mt-1 text-xs text-slate-400">
          活跃 {{ info.connections.active }} · 空闲 {{ info.connections.idle }}
        </div>
      </div>
      <div class="rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div class="mb-2 flex items-center gap-2 text-xs text-slate-500"><Icon icon="carbon:warning" /> 慢查询</div>
        <div class="text-lg font-semibold">{{ slowQueries.length }}</div>
        <div class="mt-1 text-xs text-slate-400">Top {{ slowQueries.length }} 显示</div>
      </div>
    </div>

    <a-card :bordered="false" class="shadow-sm">
      <a-tabs v-model:active-key="activeTab">
        <a-tab-pane key="overview" tab="表统计">
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <div class="mb-2 text-sm font-medium">表大小 Top 10</div>
              <ECharts :option="tableSizeOption" height="360px" />
            </div>
            <div>
              <div class="mb-2 text-sm font-medium">索引使用 Top 10</div>
              <ECharts :option="indexUsageOption" height="360px" />
            </div>
          </div>

          <a-table :data-source="tables" :pagination="false" size="small" row-key="name" class="mt-4" :columns>
          </a-table>
        </a-tab-pane>

        <a-tab-pane key="slow" tab="慢查询">
          <ECharts :option="slowQueryOption" height="320px" />
          <a-table :data-source="slowQueries" :pagination="false" size="small" class="mt-4">
            <a-table-column title="查询" data-index="query" :ellipsis="true" width="50%" />
            <a-table-column title="调用次数" data-index="calls" align="right" width="100" />
            <a-table-column title="平均耗时(ms)" data-index="meanTime" align="right" width="120" />
            <a-table-column title="总耗时(ms)" data-index="totalTime" align="right" width="120" />
            <a-table-column title="返回行数" data-index="rows" align="right" width="100" />
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-card>
  </div>
</template>
