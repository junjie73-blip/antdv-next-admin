<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { onMounted, ref, watch } from 'vue'

import { ChartCard, ChartRenderer, KpiCard, PageHeader, TimeRangeSwitch } from '../components'
import { useAnalysisData, useDashboardTheme } from '../composables'
import { analysisApi } from './api'
import { useErrorRateOption } from './options/useErrorRateOption'
import { useMainTrendOption } from './options/useMainTrendOption'
import { useModuleRankOption } from './options/useModuleRankOption'
import { useResourceRadarOption } from './options/useResourceRadarOption'
import { useSystemHealthOption } from './options/useSystemHealthOption'
import { useTrafficPieOption } from './options/useTrafficPieOption'
import { useUserJourneyOption } from './options/useUserJourneyOption'

defineOptions({ name: 'AnalysisDashboard' })

type TimeRange = 'today' | '7d' | '30d'

const { isDark } = useDashboardTheme()
const range = ref<TimeRange>('7d')

/* ============================================================
 * 数据源（8 个，与后端接口一一对应）
 * ============================================================ */
const kpi = useAnalysisData(() => analysisApi.getKpi(), [])
const trend = useAnalysisData(() => analysisApi.getActivityTrend(range.value), {
  categories: [],
  pv: [],
  uv: [],
  apiCalls: [],
})
const traffic = useAnalysisData(() => analysisApi.getTrafficDistribution(), [])
const health = useAnalysisData(() => analysisApi.getSystemHealth(), {
  health: 0,
})
const resource = useAnalysisData(() => analysisApi.getResourceUsage(), {
  indicators: [],
  current: [],
  peak: [],
})
const errorRate = useAnalysisData(() => analysisApi.getErrorRate(), {
  hours: [],
  errorRates: [],
  errors4xx: [],
  errors5xx: [],
})
const journey = useAnalysisData(() => analysisApi.getUserJourney(), [])
const moduleRank = useAnalysisData(() => analysisApi.getModuleRank(), [])

/* ============================================================
 * Option（7 个；KPI 卡片不用 option）
 * ============================================================ */
const mainTrendOption = useMainTrendOption(trend.data, isDark)
const trafficOption = useTrafficPieOption(traffic.data, isDark)
const healthOption = useSystemHealthOption(health.data, isDark)
const resourceOption = useResourceRadarOption(resource.data, isDark)
const errorOption = useErrorRateOption(errorRate.data, isDark)
const journeyOption = useUserJourneyOption(journey.data, isDark)
const moduleOption = useModuleRankOption(moduleRank.data, isDark)

/* ============================================================
 * 加载
 * ============================================================ */
async function loadAll() {
  await Promise.allSettled([
    kpi.refresh(),
    trend.refresh(),
    traffic.refresh(),
    health.refresh(),
    resource.refresh(),
    errorRate.refresh(),
    journey.refresh(),
    moduleRank.refresh(),
  ])
}

onMounted(loadAll)

/* 时间范围变化 → 仅刷新趋势 */
watch(range, () => trend.refresh())

/* 模块排行：15s 自动刷新 */
useIntervalFn(moduleRank.refresh, 15_000)
</script>

<template>
  <PerfectScrollbar class="h-full">
    <PageHeader title="数据分析" subtitle="实时数据可视化与洞察">
      <template #actions>
        <TimeRangeSwitch v-model:value="range" />
      </template>
    </PageHeader>

    <!-- ============================================================
         第一行：KPI 卡片
         ============================================================ -->
    <a-row :gutter="[16, 16]" class="mb-4">
      <a-col v-for="item in kpi.data.value" :key="item.title" :xs="24" :sm="12" :lg="6">
        <KpiCard :item="item" />
      </a-col>
    </a-row>

    <!-- ============================================================
         第二行：主趋势（全宽）
         ============================================================ -->
    <ChartCard title="系统活动趋势" :loading="trend.loading.value" class="mb-4!">
      <ChartRenderer :option="mainTrendOption" :dark="isDark" :containerHeight="480" kind="line" />
    </ChartCard>

    <!-- ============================================================
         第三行：流量分布 + 系统健康度
         ============================================================ -->
    <a-row :gutter="[16, 16]" class="mb-4">
      <a-col :xs="24" :lg="12">
        <ChartCard title="流量来源分布" :loading="traffic.loading.value">
          <ChartRenderer :option="trafficOption" :dark="isDark" kind="pie" />
        </ChartCard>
      </a-col>
      <a-col :xs="24" :lg="12">
        <ChartCard title="系统健康度" :loading="health.loading.value">
          <ChartRenderer :option="healthOption" :dark="isDark" kind="gauge" />
        </ChartCard>
      </a-col>
    </a-row>

    <!-- ============================================================
         第四行：资源使用 + API 错误率
         ============================================================ -->
    <a-row :gutter="[16, 16]" class="mb-4">
      <a-col :xs="24" :lg="12">
        <ChartCard title="资源使用概况" :loading="resource.loading.value">
          <ChartRenderer :option="resourceOption" :dark="isDark" :containerHeight="320" kind="radar" />
        </ChartCard>
      </a-col>
      <a-col :xs="24" :lg="12">
        <ChartCard title="API 错误率趋势" :loading="errorRate.loading.value">
          <ChartRenderer :option="errorOption" :dark="isDark" :containerHeight="320" kind="line" />
        </ChartCard>
      </a-col>
    </a-row>

    <!-- ============================================================
         第五行：用户漏斗 + 模块热度
         ============================================================ -->
    <a-row :gutter="[16, 16]">
      <a-col :xs="24" :lg="10">
        <ChartCard title="用户行为漏斗" :loading="journey.loading.value">
          <ChartRenderer :option="journeyOption" :dark="isDark" :containerHeight="320" kind="funnel" />
        </ChartCard>
      </a-col>
      <a-col :xs="24" :lg="14">
        <ChartCard title="模块使用热度" :loading="moduleRank.loading.value" action="tag" tag-text="15s 自动刷新">
          <ChartRenderer :option="moduleOption" :dark="isDark" :containerHeight="320" kind="bar" />
        </ChartCard>
      </a-col>
    </a-row>
  </PerfectScrollbar>
</template>
