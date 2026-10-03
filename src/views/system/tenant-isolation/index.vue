<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Tag } from 'antdv-next'
import { onMounted, onUnmounted, ref, watch, h } from 'vue'

import { useEcharts } from '~/composables/useEcharts'
import dayjs from '~/utils/dayjs'

import type { IsolationOverview, IsolationRun, IsolationTrend, RuleDistribution, TableHeat } from './types'

import { getOverview, getRecentRuns, getRuleDistribution, getTableHeatmap, getTrend } from './api'
import { REFRESH_INTERVAL_MS, TREND_DAYS, cardClassName, containerClassName, kpiCardClassName } from './constants'
import { buildBarOption, buildPieOption, buildTrendOption } from './options'
import { formatDuration, getRunStatusColor } from './utils'

defineOptions({ name: 'TenantIsolationDashboard' })

// ========== 数据 ==========
const overview = ref<IsolationOverview | null>(null)
const trend = ref<IsolationTrend | null>(null)
const ruleDist = ref<RuleDistribution[]>([])
const heatmap = ref<TableHeat[]>([])
const recentRuns = ref<IsolationRun[]>([])
const loading = ref(false)

let refreshTimer: number | null = null

// ========== 图表实例 ==========
const trendChart = useEcharts()
const pieChart = useEcharts()
const barChart = useEcharts()

// ========== 数据加载 ==========
async function loadAll() {
  loading.value = true
  try {
    const [o, t, r, h, runs] = await Promise.all([
      getOverview(),
      getTrend(TREND_DAYS),
      getRuleDistribution(),
      getTableHeatmap(),
      getRecentRuns(),
    ])
    overview.value = o
    trend.value = t
    ruleDist.value = r
    heatmap.value = h
    recentRuns.value = runs
  } catch (err) {
    console.error('[dashboard] load failed', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadAll()
  refreshTimer = window.setInterval(loadAll, REFRESH_INTERVAL_MS)
})

onUnmounted(() => {
  if (refreshTimer) window.clearInterval(refreshTimer)
})

// ========== 数据变化 → 刷新图表 ==========
watch(trend, (v) => v && trendChart.setOption(buildTrendOption(v), true))
watch(ruleDist, (v) => v.length > 0 && pieChart.setOption(buildPieOption(v), true))
watch(heatmap, (v) => v.length > 0 && barChart.setOption(buildBarOption(v), true))
</script>

<template>
  <div :class="containerClassName">
    <!-- 顶部 -->
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-slate-800">租户隔离审计大屏</h1>
        <p class="mt-1 text-xs text-slate-500">
          最后扫描：
          {{ overview?.lastRunAt ? dayjs(overview.lastRunAt).format('YYYY-MM-DD HH:mm:ss') : '—' }}
          <span
            v-if="overview?.lastRunStatus"
            class="ml-2 rounded px-2 py-0.5 text-xs"
            :class="
              overview.lastRunStatus === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            "
          >
            {{ overview.lastRunStatus }}
          </span>
        </p>
      </div>
      <a-button :loading="loading" @click="loadAll">
        <template #icon><Icon icon="ant-design:reload-outlined" /></template>
        刷新
      </a-button>
    </header>

    <!-- KPI 卡片 -->
    <section class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
      <div :class="[kpiCardClassName, 'border-l-4', 'border-red-500']">
        <div class="text-xs text-slate-500">待处理 Critical</div>
        <div class="mt-1 text-3xl font-bold text-red-600">{{ overview?.pendingCritical ?? 0 }}</div>
      </div>
      <div :class="[kpiCardClassName, 'border-l-4', 'border-amber-500']">
        <div class="text-xs text-slate-500">待处理 Warning</div>
        <div class="mt-1 text-3xl font-bold text-amber-600">
          {{ overview?.pendingWarning ?? 0 }}
        </div>
      </div>
      <div :class="[kpiCardClassName, 'border-l-4', 'border-blue-500']">
        <div class="text-xs text-slate-500">待处理 Info</div>
        <div class="mt-1 text-3xl font-bold text-blue-600">{{ overview?.pendingInfo ?? 0 }}</div>
      </div>
      <div :class="[kpiCardClassName, 'border-l-4', 'border-emerald-500']">
        <div class="text-xs text-slate-500">已修复</div>
        <div class="mt-1 text-3xl font-bold text-emerald-600">
          {{ overview?.resolvedTotal ?? 0 }}
        </div>
      </div>
      <div :class="[kpiCardClassName, 'border-l-4', 'border-slate-400']">
        <div class="text-xs text-slate-500">累计扫描次数</div>
        <div class="mt-1 text-3xl font-bold text-slate-700">{{ overview?.totalRuns ?? 0 }}</div>
      </div>
    </section>

    <!-- 趋势图 -->
    <section :class="cardClassName">
      <h2 class="mb-2 text-sm font-medium text-slate-700">近 30 天趋势</h2>
      <div ref="trendChart.containerRef" style="height: 320px"></div>
    </section>

    <!-- 规则分布 + 表热度 -->
    <section class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div :class="cardClassName">
        <h2 class="mb-2 text-sm font-medium text-slate-700">规则分布 Top 10</h2>
        <div ref="pieChart.containerRef" style="height: 320px"></div>
      </div>
      <div :class="cardClassName">
        <h2 class="mb-2 text-sm font-medium text-slate-700">表热度 Top 10</h2>
        <div ref="barChart.containerRef" style="height: 320px"></div>
      </div>
    </section>

    <!-- 最近扫描历史 -->
    <section :class="cardClassName">
      <h2 class="mb-2 text-sm font-medium text-slate-700">最近 10 次扫描</h2>
      <a-table :data-source="recentRuns" :pagination="false" size="small" row-key="run_id" :scroll="{ x: 900 }">
        <a-table-column title="开始时间" data-index="startedAt" :width="160"> </a-table-column>
        <a-table-column title="触发" data-index="triggerType" :width="80" />
        <a-table-column
          title="状态"
          data-index="status"
          :width="90"
          :render="
            (text) => {
              return h(Tag, { color: getRunStatusColor(text) }, text)
            }
          "
        >
        </a-table-column>
        <a-table-column title="Critical" data-index="criticalCount" :width="90" />
        <a-table-column title="Warning" data-index="warningCount" :width="90" />
        <a-table-column title="Info" data-index="infoCount" :width="80" />
        <a-table-column title="新增" data-index="newCount" :width="80" />
        <a-table-column title="修复" data-index="resolvedCount" :width="80" />
        <a-table-column
          title="耗时"
          data-index="durationMs"
          :width="90"
          :render="
            (text) => {
              return formatDuration(text)
            }
          "
        >
        </a-table-column>
      </a-table>
    </section>
  </div>
</template>

<style scoped>
.kpi-card {
  transition: transform 0.15s ease;
}
.kpi-card:hover {
  transform: translateY(-2px);
}
</style>
