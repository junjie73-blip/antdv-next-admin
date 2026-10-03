<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { computed, onMounted } from 'vue'

import { ChartCard, ChartRenderer, PageHeader, StatCard, TimelineList } from '../components'
import { useDashboardTheme, useAnalysisData } from '../composables'
import { orgHistoryApi, type DeptTransferHeat, type TopOperator } from './api'
import { useChangeTypeOption } from './options/useChangeTypeOption'
import { useDeptTimeHeatmapOption } from './options/useDeptTimeHeatmapOption'
import { useDeptTransferOption } from './options/useDeptTransferOption'
import { useOrgDailyTrendOption } from './options/useOrgDailyTrendOption'
import { useOrgScopeOption } from './options/useOrgScopeOption'
import { useTopOperatorsOption } from './options/useTopOperatorsOption'

defineOptions({ name: 'OrgHistoryDashboard' })

const { isDark } = useDashboardTheme()

/* ========== 数据源 ========== */
const overview = useAnalysisData(() => orgHistoryApi.getOverview(), {
  total: 0,
  last30dByScope: [],
  topChangeType: null,
  latest: null,
})
const trend = useAnalysisData(() => orgHistoryApi.getDailyTrend(30), {
  dates: [],
  scopes: [],
  series: [],
})
const transfer = useAnalysisData<DeptTransferHeat[]>(() => orgHistoryApi.getDeptTransfer(30), [])
const topOps = useAnalysisData<TopOperator[]>(() => orgHistoryApi.getTopOperators(30, 10), [])
const matrix = useAnalysisData(() => orgHistoryApi.getDeptTimeMatrix(30, 'total'), {
  dates: [],
  depts: [],
  deptIds: [],
  data: [],
  max: 0,
  metric: 'total' as const,
})
const recent = useAnalysisData(() => orgHistoryApi.getRecentChanges(15), [])

/* ========== Option ========== */
const trendOption = useOrgDailyTrendOption(trend.data, isDark)
const matrixOption = useDeptTimeHeatmapOption(matrix.data, isDark)
const transferOption = useDeptTransferOption(transfer.data, isDark)
const topOpsOption = useTopOperatorsOption(topOps.data, isDark)
const scopeOption = useOrgScopeOption(overview.data, isDark)

const changeCounts = computed<Record<string, number>>(() => {
  const map: Record<string, number> = {}
  for (const e of recent.data.value) {
    map[e.change_type] = (map[e.change_type] ?? 0) + 1
  }
  return map
})
const changeTypeOption = useChangeTypeOption(changeCounts, isDark)

/* ========== 加载 ========== */
async function loadAll() {
  await Promise.allSettled([
    overview.refresh(),
    trend.refresh(),
    transfer.refresh(),
    topOps.refresh(),
    matrix.refresh(),
    recent.refresh(),
  ])
}

onMounted(loadAll)
useIntervalFn(overview.refresh, 60_000)

/* ========== 时间轴 ========== */
const changeTimeline = computed(() =>
  recent.data.value.map((e) => ({
    id: e.history_id,
    title: e.summary ?? '—',
    time: e.created_at,
    tag: e.change_type,
    tagColor:
      e.change_type === 'create'
        ? 'green'
        : e.change_type === 'delete'
          ? 'red'
          : e.change_type === 'transfer' || e.change_type === 'move'
            ? 'purple'
            : 'blue',
    desc: e.scope ?? undefined,
    operator: e.operator_name ?? '系统',
  })),
)
</script>

<template>
  <PerfectScrollbar class="h-full">
    <PageHeader title="组织架构变更大屏" subtitle="追踪部门/角色/人员的历史调整" @refresh="loadAll" />

    <!-- KPI -->
    <a-row :gutter="[16, 16]" class="mb-6">
      <a-col :xs="12" :sm="8" :lg="6">
        <StatCard label="累计变更" :value="overview.data.value.total" color="blue" icon="carbon:change-catalog" />
      </a-col>
      <a-col
        v-for="s in overview.data.value.last30dByScope.slice(0, 3)"
        :key="s.scope ?? 'other'"
        :xs="12"
        :sm="8"
        :lg="6"
      >
        <StatCard :label="`${s.scope ?? '其他'}（30d）`" :value="s.count" color="emerald" icon="carbon:chart-line" />
      </a-col>
    </a-row>

    <!-- 每日趋势 -->
    <ChartCard title="每日变更趋势（按类型堆叠）" :loading="trend.loading.value" class="mb-4!">
      <ChartRenderer :option="trendOption" :dark="isDark" :height="320" kind="line" />
    </ChartCard>

    <!-- 部门 × 时间热力图 -->
    <ChartCard title="部门 × 时间 变更热力图" :loading="matrix.loading.value" class="mb-4!">
      <ChartRenderer :option="matrixOption" :dark="isDark" :height="440" kind="heatmap" />
    </ChartCard>

    <!-- 第二行 -->
    <a-row :gutter="[16, 16]" class="mb-4">
      <a-col :xs="24" :lg="14">
        <ChartCard title="部门调动热度" :loading="transfer.loading.value">
          <ChartRenderer :option="transferOption" :dark="isDark" :height="360" kind="bar" />
        </ChartCard>
      </a-col>
      <a-col :xs="24" :lg="10">
        <ChartCard title="Top 操作者" :loading="topOps.loading.value">
          <ChartRenderer :option="topOpsOption" :dark="isDark" :height="360" kind="pie" />
        </ChartCard>
      </a-col>
    </a-row>

    <!-- 第三行 -->
    <a-row :gutter="[16, 16]" class="mb-4">
      <a-col :xs="24" :lg="12">
        <ChartCard title="变更类型分布" :loading="recent.loading.value">
          <ChartRenderer :option="changeTypeOption" :dark="isDark" :height="320" kind="pie" />
        </ChartCard>
      </a-col>
      <a-col :xs="24" :lg="12">
        <ChartCard title="变更范围（30 天）" :loading="overview.loading.value">
          <ChartRenderer :option="scopeOption" :dark="isDark" :height="320" kind="radar" />
        </ChartCard>
      </a-col>
    </a-row>

    <!-- 最近变更 -->
    <ChartCard title="最近变更" :loading="recent.loading.value">
      <TimelineList :items="changeTimeline" />
    </ChartCard>
  </PerfectScrollbar>
</template>
