<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { useEventListener } from "@vueuse/core";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

import { getDashboardKpi } from "@/api";
import { useAppStore } from "@/stores/modules/app";
import { cn } from "@/utils/cn";

// 抽离的模块
import { analyticsCardClassName, sectionTitleClassName, TIME_RANGE_OPTIONS } from "./constants";
import { borderBeamColor, kpiIconWrap } from "./kpi";
import { useChartManager } from "./hooks/useChartManager";
import { useExportReport } from "./hooks/useExportReport";
import type { KpiItem, TimeRange } from "./types";

// 各图表
import { initMainTrend } from "./charts/mainTrend";
import { initTrafficDist } from "./charts/trafficDist";
import { initSystemHealth } from "./charts/systemHealth";
import { initResourceRadar } from "./charts/resourceRadar";
import { initErrorRate } from "./charts/errorRate";
import { initUserJourney } from "./charts/userJourney";
import { initModuleRank } from "./charts/moduleRank";

defineOptions({ name: "DashboardAnalysis" });

// ========== Store ==========
const appStore = useAppStore();
const isDark = computed(() => appStore.themeMode === "dark");

// ========== 范围 ==========
const currentRange = ref<TimeRange>("7d");

// ========== KPI ==========
const kpiList = ref<KpiItem[]>([]);
const kpiLoading = ref(false);

async function loadKpi() {
  kpiLoading.value = true;
  try {
    const res = await getDashboardKpi();
    kpiList.value = res?.data ?? res ?? [];
  } catch (e) {
    console.warn("加载 KPI 失败", e);
  } finally {
    kpiLoading.value = false;
  }
}

// ========== 各区块 loading ==========
const mainTrendLoading = ref(false);
const trafficDistLoading = ref(false);
const systemHealthLoading = ref(false);
const resourceRadarLoading = ref(false);
const activityHeatmapLoading = ref(false);
const userJourneyLoading = ref(false);
const moduleRankLoading = ref(false);

// ========== DOM 引用 ==========
const mainTrendRef = ref<HTMLDivElement>();
const trafficDistRef = ref<HTMLDivElement>();
const systemHealthRef = ref<HTMLDivElement>();
const resourceRadarRef = ref<HTMLDivElement>();
const activityHeatmapRef = ref<HTMLDivElement>();
const userJourneyRef = ref<HTMLDivElement>();
const moduleRankRef = ref<HTMLDivElement>();

// ========== 图表管理 ==========
const { safeInit, disposeAll, remove, resizeAll } = useChartManager();

/** 用 loading 状态包一层图表初始化 */
function withLoading(loadingRef: typeof mainTrendLoading, fn: () => Promise<any>) {
  return async () => {
    loadingRef.value = true;
    try {
      await fn();
    } finally {
      loadingRef.value = false;
    }
  };
}

function initAllCharts() {
  const dark = isDark.value;

  safeInit(
    "mainTrend",
    mainTrendRef,
    withLoading(mainTrendLoading, async () => {
      const instance = await initMainTrend(mainTrendRef.value!, dark, currentRange.value);
      return instance;
    }),
  );

  safeInit(
    "trafficDist",
    trafficDistRef,
    withLoading(trafficDistLoading, () => initTrafficDist(trafficDistRef.value!, dark)),
  );

  safeInit(
    "systemHealth",
    systemHealthRef,
    withLoading(systemHealthLoading, () => initSystemHealth(systemHealthRef.value!, dark)),
  );

  safeInit(
    "resourceRadar",
    resourceRadarRef,
    withLoading(resourceRadarLoading, () => initResourceRadar(resourceRadarRef.value!, dark)),
  );

  safeInit(
    "activityHeatmap",
    activityHeatmapRef,
    withLoading(activityHeatmapLoading, () => initErrorRate(activityHeatmapRef.value!, dark)),
  );

  safeInit(
    "userJourney",
    userJourneyRef,
    withLoading(userJourneyLoading, () => initUserJourney(userJourneyRef.value!, dark)),
  );

  safeInit(
    "moduleRank",
    moduleRankRef,
    withLoading(moduleRankLoading, () => initModuleRank(moduleRankRef.value!, dark)),
  );
}

// ========== 报告导出 ==========
const { handleExport } = useExportReport({
  isDark,
  getChart: (name) => {
    // 从 useChartManager 里取实例
    const { get } = useChartManager();
    return get(name);
  },
  chartCount: 7,
});

// ========== 生命周期 ==========
useEventListener(window, "resize", resizeAll);

onMounted(async () => {
  await loadKpi();
  nextTick(() => initAllCharts());
});

// 时间范围变化：只重建主趋势图
watch(currentRange, async () => {
  remove("mainTrend");
  await initMainTrend(mainTrendRef.value!, isDark.value, currentRange.value).then((instance) => {
    // 手动注册（remove 已 dispose 旧的）
    const { get } = useChartManager();
    if (!get("mainTrend")) {
      // 通过 safeInit 走一遍注册路径
      safeInit(
        "mainTrend",
        mainTrendRef,
        withLoading(mainTrendLoading, async () => {
          const inst = await initMainTrend(mainTrendRef.value!, isDark.value, currentRange.value);
          return inst;
        }),
      );
    }
    return instance;
  });
});

onBeforeUnmount(() => {
  disposeAll();
});
</script>

<template>
  <div>
    <!-- 页面标题 -->
    <div class="flex items-center justify-between mb-2">
      <div>
        <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">数据分析</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">系统数据分析与可视化</p>
      </div>
      <a-space>
        <a-segmented v-model:value="currentRange" :options="TIME_RANGE_OPTIONS" size="small" />
        <a-button size="small" @click="handleExport">
          <template #icon><Icon icon="carbon:download" /></template>
          导出报告
        </a-button>
      </a-space>
    </div>

    <!-- 数据分析内容 -->
    <div class="space-y-8">
      <!-- KPI 统计卡片区 -->
      <a-row :gutter="[16, 16]" class="mb-6">
        <template v-if="kpiLoading">
          <a-col v-for="i in 4" :key="`sk-${i}`" :xs="24" :sm="12" :lg="6">
            <div
              class="rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-5"
            >
              <a-skeleton active :paragraph="{ rows: 2 }" />
            </div> </a-col
        ></template>
        <template v-else>
          <a-col v-for="kpi in kpiList" :key="kpi.title" :xs="24" :sm="12" :lg="6">
            <a-border-beam
              :color="borderBeamColor(kpi.color)"
              :size="160"
              :duration="8"
              :border-width="1.5"
            >
              <div
                :class="
                  cn(
                    'rounded-xl p-5 transition-all duration-300',
                    ' bg-white dark:bg-slate-900 transition-all duration-300',
                    'hover:shadow-[0_8px_24px_-8px_rgba(15,23,42,0.12)]',
                    'dark:hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]',
                  )
                "
              >
                <div class="flex items-start justify-between gap-4">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-2">
                      <span
                        class="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider"
                      >
                        {{ kpi.title }}
                      </span>
                    </div>
                    <div class="flex items-baseline gap-2">
                      <span class="text-3xl font-bold text-gray-800 dark:text-white tracking-tight">
                        {{ kpi.value }}
                      </span>
                    </div>
                    <div class="flex items-center gap-1 mt-2">
                      <span
                        :class="
                          cn(
                            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-semibold',
                            kpi.trend >= 0
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
                          )
                        "
                      >
                        <Icon
                          :icon="kpi.trend >= 0 ? 'carbon:arrow-up' : 'carbon:arrow-down'"
                          :width="12"
                          :height="12"
                        />
                        {{ Math.abs(kpi.trend) }}%
                      </span>
                      <span class="text-xs text-gray-400 dark:text-gray-500">
                        {{ kpi.trendLabel }}
                      </span>
                    </div>
                  </div>

                  <div
                    :class="
                      cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
                        'transition-transform duration-300 group-hover:scale-110',
                        kpiIconWrap(kpi.color),
                      )
                    "
                  >
                    <Icon :icon="kpi.icon" :width="24" :height="24" />
                  </div>
                </div>
              </div>
            </a-border-beam>
          </a-col>
        </template>
      </a-row>

      <!-- 主趋势图 -->
      <a-card
        :class="analyticsCardClassName"
        variant="borderless"
        :styles="{ body: { padding: '20px 24px' } }"
        class="mt-6"
      >
        <div class="flex items-center justify-between mb-4">
          <h3 :class="sectionTitleClassName">系统活动趋势</h3>
          <a-radio-group
            size="small"
            button-style="solid"
            default-value="pv"
            class="scale-90 origin-right"
          >
            <a-radio-button value="pv"> PV / UV </a-radio-button>
            <a-radio-button value="api"> API 调用 </a-radio-button>
          </a-radio-group>
        </div>
        <a-spin :spinning="mainTrendLoading" description="加载中...">
          <div ref="mainTrendRef" class="w-full" style="height: 380px" />
        </a-spin>
      </a-card>

      <!-- 第二行 -->
      <a-row :gutter="[16, 16]" class="mt-6">
        <a-col :xs="24" :lg="12">
          <a-card
            :class="analyticsCardClassName"
            variant="borderless"
            :styles="{ body: { padding: '20px 24px' } }"
          >
            <h3 :class="sectionTitleClassName">流量来源分布</h3>
            <a-spin :spinning="trafficDistLoading" description="加载中...">
              <div ref="trafficDistRef" class="w-full" style="height: 320px" />
            </a-spin>
          </a-card>
        </a-col>
        <a-col :xs="24" :lg="12">
          <a-card
            :class="analyticsCardClassName"
            variant="borderless"
            :styles="{ body: { padding: '20px 24px' } }"
          >
            <h3 :class="sectionTitleClassName">系统健康度</h3>
            <a-spin :spinning="systemHealthLoading" description="加载中...">
              <div ref="systemHealthRef" class="w-full" style="height: 320px" />
            </a-spin>
          </a-card>
        </a-col>
      </a-row>

      <!-- 第三行 -->
      <a-row :gutter="[16, 16]">
        <a-col :xs="24" :lg="12">
          <a-card
            :class="analyticsCardClassName"
            variant="borderless"
            :styles="{ body: { padding: '20px 24px' } }"
          >
            <h3 :class="sectionTitleClassName">资源使用概况</h3>
            <a-spin :spinning="resourceRadarLoading" description="加载中...">
              <div ref="resourceRadarRef" class="w-full" style="height: 320px" />
            </a-spin>
          </a-card>
        </a-col>
        <a-col :xs="24" :lg="12">
          <a-card
            :class="analyticsCardClassName"
            variant="borderless"
            :styles="{ body: { padding: '20px 24px' } }"
          >
            <h3 :class="sectionTitleClassName">API 错误率趋势</h3>
            <a-spin :spinning="activityHeatmapLoading" description="加载中...">
              <div ref="activityHeatmapRef" class="w-full" style="height: 320px" />
            </a-spin>
          </a-card>
        </a-col>
      </a-row>

      <!-- 第四行 -->
      <a-row :gutter="[16, 16]" class="items-stretch mb-12">
        <a-col :xs="24" :lg="10" class="mb-2">
          <a-card
            :class="cn(analyticsCardClassName, 'h-full')"
            variant="borderless"
            :styles="{ body: { padding: '20px 24px', display: 'flex', flexDirection: 'column' } }"
          >
            <h3 :class="sectionTitleClassName">用户行为漏斗</h3>
            <a-spin :spinning="userJourneyLoading" description="加载中...">
              <div ref="userJourneyRef" class="w-full flex-1" style="min-height: 280px" />
            </a-spin>
          </a-card>
        </a-col>
        <a-col :xs="24" :lg="14" class="mb-2">
          <a-card
            :class="cn(analyticsCardClassName, 'h-full')"
            variant="borderless"
            :styles="{ body: { padding: '20px 24px', display: 'flex', flexDirection: 'column' } }"
          >
            <div class="flex items-center justify-between mb-4">
              <h3 :class="sectionTitleClassName">模块使用热度</h3>
              <a-tag color="blue" class="text-[11px]">实时更新</a-tag>
            </div>
            <a-spin :spinning="moduleRankLoading" description="加载中...">
              <div ref="moduleRankRef" class="w-full flex-1" style="min-height: 280px" />
            </a-spin>
          </a-card>
        </a-col>
      </a-row>
    </div>
  </div>
</template>
