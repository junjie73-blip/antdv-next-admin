<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { onMounted, ref, watch } from 'vue'

import { ChartRenderer } from '../components'
import { useAnalysisData, useDashboardTheme } from '../composables'
import { analysisApi } from './api'
import ScreenHeader from './components/ScreenHeader.vue'
import ScreenKpiCard from './components/ScreenKpiCard.vue'
import ScreenLayout from './components/ScreenLayout.vue'
import ScreenPanel from './components/ScreenPanel.vue'
import ScreenRangeSwitch, { type TimeRange } from './components/ScreenRangeSwitch.vue'
import { useErrorRateOption } from './options/useErrorRateOption'
import { useMainTrendOption } from './options/useMainTrendOption'
import { useModuleRankOption } from './options/useModuleRankOption'
import { useResourceRadarOption } from './options/useResourceRadarOption'
import { useSystemHealthOption } from './options/useSystemHealthOption'
import { useTrafficPieOption } from './options/useTrafficPieOption'
import { useUserJourneyOption } from './options/useUserJourneyOption'

defineOptions({ name: 'AnalysisDashboard' })

const { isDark } = useDashboardTheme()
const range = ref<TimeRange>('7d')

/* 数据源 */
const kpi = useAnalysisData(() => analysisApi.getKpi(), [])
const trend = useAnalysisData(() => analysisApi.getActivityTrend(range.value), {
  categories: [],
  pv: [],
  uv: [],
  apiCalls: [],
})
const traffic = useAnalysisData(() => analysisApi.getTrafficDistribution(), [])
const health = useAnalysisData(() => analysisApi.getSystemHealth(), { health: 0 })
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

/* Option */
const mainTrendOption = useMainTrendOption(trend.data, isDark)
const trafficOption = useTrafficPieOption(traffic.data, isDark)
const healthOption = useSystemHealthOption(health.data, isDark)
const resourceOption = useResourceRadarOption(resource.data, isDark)
const errorOption = useErrorRateOption(errorRate.data, isDark)
const journeyOption = useUserJourneyOption(journey.data, isDark)
const moduleOption = useModuleRankOption(moduleRank.data, isDark)

/* 加载 */
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
watch(range, () => trend.refresh())
useIntervalFn(moduleRank.refresh, 15_000)
</script>

<template>
  <ScreenLayout>
    <ScreenHeader title="数据分析大屏" subtitle="ANALYTICS MONITOR">
      <template #actions>
        <!-- ⭐ 用大屏风格的切换器替代 a-radio-group -->
        <ScreenRangeSwitch v-model="range" />
      </template>
    </ScreenHeader>

    <main class="screen-main">
      <!-- KPI -->
      <section class="kpi-row">
        <ScreenKpiCard v-for="item in kpi.data.value" :key="item.title" :item="item" />
      </section>

      <!-- 三列 -->
      <section class="grid-row">
        <div class="col">
          <ScreenPanel title="流量来源分布" :loading="traffic.loading.value" class="grow">
            <ChartRenderer :option="trafficOption" :dark="isDark" kind="pie" />
          </ScreenPanel>
          <ScreenPanel title="用户行为漏斗" :loading="journey.loading.value" class="grow">
            <ChartRenderer :option="journeyOption" :dark="isDark" kind="funnel" />
          </ScreenPanel>
        </div>

        <div class="col">
          <ScreenPanel title="系统活动趋势" :loading="trend.loading.value" class="grow">
            <ChartRenderer :option="mainTrendOption" :dark="isDark" kind="line" />
          </ScreenPanel>
          <ScreenPanel title="API 错误率趋势" :loading="errorRate.loading.value" class="grow">
            <ChartRenderer :option="errorOption" :dark="isDark" kind="line" />
          </ScreenPanel>
        </div>

        <div class="col">
          <ScreenPanel title="系统健康度" :loading="health.loading.value" class="grow">
            <ChartRenderer :option="healthOption" :dark="isDark" kind="gauge" />
          </ScreenPanel>
          <ScreenPanel title="资源使用概况" :loading="resource.loading.value" class="grow">
            <ChartRenderer :option="resourceOption" :dark="isDark" kind="radar" />
          </ScreenPanel>
          <ScreenPanel title="模块使用热度" :loading="moduleRank.loading.value" class="grow">
            <template #extra>15s 自动刷新</template>
            <ChartRenderer :option="moduleOption" :dark="isDark" kind="bar" />
          </ScreenPanel>
        </div>
      </section>
    </main>
  </ScreenLayout>
</template>

<style scoped>
.screen-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 16px 16px;
  overflow: hidden;
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.grid-row {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1.5fr 1fr;
  gap: 12px;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.grow {
  flex: 1;
  min-height: 0;
}
</style>
