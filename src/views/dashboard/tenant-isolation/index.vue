<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useIntervalFn } from '@vueuse/core'
import { message, type TableProps } from 'antdv-next'
import { computed, onMounted, ref } from 'vue'

import dayjs from '~/utils/dayjs'

import { ChartCard, ChartRenderer, PageHeader, StatCard, TimelineList } from '../components'
import { useAnalysisData, useDashboardTheme } from '../composables'
import {
  tenantIsolationApi,
  type IsolationRun,
  type IsolationViolation,
  type RuleDistribution,
  type TableHeat,
} from './api'
import { useRuleDistributionOption } from './options/useRuleDistributionOption'
import { useRunDurationOption } from './options/useRunDurationOption'
import { useScanTrendOption } from './options/useScanTrendOption'
import { useSeverityBreakdownOption } from './options/useSeverityBreakdownOption'
import { useTableHeatmapOption } from './options/useTableHeatmapOption'

defineOptions({ name: 'TenantIsolationDashboard' })

const { isDark } = useDashboardTheme()

/* ============================================================
 * 数据源（严格对齐 6 个接口）
 * ============================================================ */
const overview = useAnalysisData(() => tenantIsolationApi.getOverview(), {
  pendingCritical: 0,
  pendingWarning: 0,
  pendingInfo: 0,
  resolvedTotal: 0,
  totalRuns: 0,
  lastRunAt: null,
  lastRunStatus: null,
})

const trend = useAnalysisData(() => tenantIsolationApi.getTrend(30), {
  dates: [],
  newCounts: [],
  resolvedCounts: [],
  criticalSeries: [],
  warningSeries: [],
})

const ruleDist = useAnalysisData<RuleDistribution[]>(() => tenantIsolationApi.getRuleDistribution(), [])

const tableHeat = useAnalysisData<TableHeat[]>(() => tenantIsolationApi.getTableHeatmap(), [])

const recentRuns = useAnalysisData<IsolationRun[]>(() => tenantIsolationApi.getRecentRuns(20), [])

const violations = useAnalysisData<IsolationViolation[]>(
  () => tenantIsolationApi.getViolations({ pageNum: 1, pageSize: 20, resolved: 0 }).then((r) => r.list),
  [],
)

/* ============================================================
 * Option（5 张图）
 * ============================================================ */
const trendOption = useScanTrendOption(trend.data, isDark)
const ruleDistOption = useRuleDistributionOption(ruleDist.data, isDark)
const tableHeatOption = useTableHeatmapOption(tableHeat.data, isDark)
const severityOption = useSeverityBreakdownOption(ruleDist.data, isDark)
const durationOption = useRunDurationOption(recentRuns.data, isDark)

/* ============================================================
 * 加载
 * ============================================================ */
async function loadAll() {
  await Promise.allSettled([
    overview.refresh(),
    trend.refresh(),
    ruleDist.refresh(),
    tableHeat.refresh(),
    recentRuns.refresh(),
    violations.refresh(),
  ])
}

onMounted(loadAll)

/* 概览 60s 自动刷新 */
useIntervalFn(overview.refresh, 60_000)

/* ============================================================
 * 操作
 * ============================================================ */
const scanning = ref(false)

async function handleScan() {
  scanning.value = true
  try {
    await tenantIsolationApi.triggerScan()
    message.success('扫描任务已提交')
    setTimeout(loadAll, 3000)
  } catch (e: any) {
    message.error(e?.message ?? '扫描失败')
  } finally {
    scanning.value = false
  }
}

async function handleResolve(v: IsolationViolation) {
  try {
    await tenantIsolationApi.resolve(v.scan_id)
    message.success('已标记为修复')
    loadAll()
  } catch (e: any) {
    message.error(e?.message ?? '操作失败')
  }
}

/* ============================================================
 * 时间轴数据
 * ============================================================ */
const runTimeline = computed(() =>
  recentRuns.data.value.slice(0, 10).map((r) => ({
    id: r.run_id,
    title: `${r.trigger_type} 扫描`,
    time: r.started_at,
    tag: r.status,
    tagColor: r.status === 'completed' ? 'green' : r.status === 'failed' ? 'red' : 'blue',
    desc: `Critical ${r.critical_count} / Warning ${r.warning_count} / 新增 ${r.new_count} / 修复 ${r.resolved_count}`,
  })),
)

/* ============================================================
 * 违规记录表格列
 * ============================================================ */
const violationColumns: TableProps['columns'] = [
  { title: '严重级别', dataIndex: 'severity', key: 'severity', width: 100 },
  { title: '规则', dataIndex: 'rule_code', key: 'rule_code', width: 220, ellipsis: true },
  { title: '表', dataIndex: 'table_name', key: 'table_name', width: 180, ellipsis: true },
  { title: '列', dataIndex: 'column_name', key: 'column_name', width: 140, ellipsis: true },
  { title: '描述', dataIndex: 'message', key: 'message', ellipsis: true },
  { title: '命中', dataIndex: 'hit_count', key: 'hit_count', width: 70, align: 'center' },
  { title: '首次发现', dataIndex: 'first_seen_at', key: 'first_seen_at', width: 160 },
  { title: '操作', key: 'action', width: 90, align: 'center' },
]

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'red',
  warning: 'orange',
  info: 'blue',
}

function formatTime(t: string) {
  return dayjs(t).format('YYYY-MM-DD HH:mm')
}
</script>

<template>
  <PerfectScrollbar class="h-full">
    <PageHeader
      title="租户隔离审计大屏"
      subtitle="持续监控跨租户数据泄漏风险"
      :last-updated="overview.data.value.lastRunAt"
      @refresh="loadAll"
    >
      <template #actions>
        <a-button type="primary" size="small" :loading="scanning" @click="handleScan">
          <template #icon><Icon icon="carbon:play-filled" /></template>
          手动扫描
        </a-button>
      </template>
    </PageHeader>

    <!-- KPI 6 张 -->
    <a-row :gutter="[16, 16]" class="mb-6">
      <a-col :xs="12" :sm="8" :lg="4">
        <StatCard
          label="待处理 Critical"
          :value="overview.data.value.pendingCritical"
          color="red"
          icon="carbon:warning-filled"
        />
      </a-col>
      <a-col :xs="12" :sm="8" :lg="4">
        <StatCard
          label="待处理 Warning"
          :value="overview.data.value.pendingWarning"
          color="amber"
          icon="carbon:warning-alt"
        />
      </a-col>
      <a-col :xs="12" :sm="8" :lg="4">
        <StatCard label="待处理 Info" :value="overview.data.value.pendingInfo" color="blue" icon="carbon:information" />
      </a-col>
      <a-col :xs="12" :sm="8" :lg="4">
        <StatCard
          label="已修复"
          :value="overview.data.value.resolvedTotal"
          color="emerald"
          icon="carbon:checkmark-filled"
        />
      </a-col>
      <a-col :xs="12" :sm="8" :lg="4">
        <StatCard label="累计扫描次数" :value="overview.data.value.totalRuns" color="violet" icon="carbon:renew" />
      </a-col>
      <a-col :xs="12" :sm="8" :lg="4">
        <StatCard
          label="最近扫描状态"
          :value="overview.data.value.lastRunStatus ?? '—'"
          :color="
            overview.data.value.lastRunStatus === 'completed'
              ? 'emerald'
              : overview.data.value.lastRunStatus === 'failed'
                ? 'red'
                : 'amber'
          "
          icon="carbon:status-change"
        />
      </a-col>
    </a-row>

    <!-- 近 30 天趋势 -->
    <ChartCard title="近 30 天趋势" :loading="trend.loading.value" class="mb-4">
      <ChartRenderer :option="trendOption" :dark="isDark" :height="320" kind="line" />
    </ChartCard>

    <!-- 第二行：规则分布 + 严重级别分布 -->
    <a-row :gutter="[16, 16]" class="mb-4">
      <a-col :xs="24" :lg="12">
        <ChartCard title="规则分布 Top 10" :loading="ruleDist.loading.value">
          <ChartRenderer :option="ruleDistOption" :dark="isDark" :height="340" kind="pie" />
        </ChartCard>
      </a-col>
      <a-col :xs="24" :lg="12">
        <ChartCard title="严重级别分布" :loading="ruleDist.loading.value">
          <ChartRenderer :option="severityOption" :dark="isDark" :height="340" kind="pie" />
        </ChartCard>
      </a-col>
    </a-row>

    <!-- 第三行：表热度 + 扫描耗时 -->
    <a-row :gutter="[16, 16]" class="mb-4">
      <a-col :xs="24" :lg="12">
        <ChartCard title="表热度 Top 10" :loading="tableHeat.loading.value">
          <ChartRenderer :option="tableHeatOption" :dark="isDark" :height="340" kind="bar" />
        </ChartCard>
      </a-col>
      <a-col :xs="24" :lg="12">
        <ChartCard title="扫描耗时趋势" :loading="recentRuns.loading.value">
          <ChartRenderer :option="durationOption" :dark="isDark" :height="340" kind="line" />
        </ChartCard>
      </a-col>
    </a-row>

    <!-- 第四行：待处理违规表 -->
    <ChartCard
      title="待处理违规记录"
      :loading="violations.loading.value"
      class="mb-4"
      action="refresh"
      @refresh="violations.refresh"
    >
      <a-table
        :data-source="violations.data.value"
        :columns="violationColumns"
        :pagination="{ pageSize: 10, size: 'small' }"
        size="small"
        row-key="scan_id"
        :scroll="{ x: 1200 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'severity'">
            <a-tag :color="SEVERITY_COLOR[record.severity]" :bordered="false">
              {{ record.severity.toUpperCase() }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'rule_code'">
            <code class="text-xs">{{ record.rule_code }}</code>
          </template>
          <template v-else-if="column.key === 'first_seen_at'">
            <span class="text-xs text-slate-500">
              {{ formatTime(record.first_seen_at) }}
            </span>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" size="small" @click="handleResolve(record as IsolationViolation)">
              标记修复
            </a-button>
          </template>
        </template>
      </a-table>
    </ChartCard>

    <!-- 第五行：最近扫描时间轴 -->
    <ChartCard title="最近扫描历史" :loading="recentRuns.loading.value">
      <TimelineList :items="runTimeline" />
    </ChartCard>
  </PerfectScrollbar>
</template>
