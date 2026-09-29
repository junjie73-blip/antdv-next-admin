<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { message, Tag, type TableProps } from "antdv-next";
import dayjs from "dayjs";
import { computed, onMounted, ref, watch } from "vue";
import ECharts from "~/components/common/ECharts/index.vue";
import {
  getOperationList,
  getOverview,
  getTopOperations,
  getTrend,
  triggerAggregate,
  triggerClean,
} from "./api";
import type { Overview, TopOperation, TrendData } from "./types";

defineOptions({ name: "MonitorAuditDaily" });

/* ============================================================
 * 状态
 * ============================================================ */
const loading = ref(false);
const dateRange = ref<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().subtract(29, "day"), dayjs()]);
const selectedOperation = ref<string | undefined>(undefined);
const operationList = ref<string[]>([]);

const overview = ref<Overview | null>(null);
const trend = ref<TrendData | null>(null);
const topOps = ref<TopOperation[]>([]);

/* ============================================================
 * 查询参数
 * ============================================================ */
const queryParams = computed(() => ({
  startDate: dateRange.value[0].format("YYYY-MM-DD"),
  endDate: dateRange.value[1].format("YYYY-MM-DD"),
  operation: selectedOperation.value || undefined,
}));

/* ============================================================
 * 加载数据
 * ============================================================ */
async function loadAll() {
  loading.value = true;
  try {
    const [ov, tr, tp]: any[] = await Promise.all([
      getOverview(queryParams.value),
      getTrend(queryParams.value),
      getTopOperations({ ...queryParams.value, limit: 20 }),
    ]);
    overview.value = ov?.data ?? ov;
    trend.value = tr?.data ?? tr;
    topOps.value = tp?.data ?? tp ?? [];
  } catch (e: any) {
    message.error(e?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

async function loadOperations() {
  try {
    const res: any = await getOperationList();
    operationList.value = res?.data ?? res ?? [];
  } catch {
    operationList.value = [];
  }
}

/* ============================================================
 * 手动聚合 / 清理
 * ============================================================ */
const aggregating = ref(false);
const cleaning = ref(false);

async function handleAggregate() {
  aggregating.value = true;
  try {
    const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");
    const res: any = await triggerAggregate({ date: yesterday });
    const data = res?.data ?? res;
    message.success(`聚合完成：审计 ${data.auditOps} 条，登录 ${data.loginRows} 条`);
    await loadAll();
  } catch (e: any) {
    message.error(e?.message || "聚合失败");
  } finally {
    aggregating.value = false;
  }
}

async function handleClean() {
  cleaning.value = true;
  try {
    const res: any = await triggerClean();
    const data = res?.data ?? res;
    message.success(`已清理：审计 ${data.audit} 条，登录 ${data.login} 条`);
  } catch (e: any) {
    message.error(e?.message || "清理失败");
  } finally {
    cleaning.value = false;
  }
}

/* ============================================================
 * 快捷日期
 * ============================================================ */
const PRESET_RANGES = [
  { label: "最近 7 天", days: 7 },
  { label: "最近 30 天", days: 30 },
  { label: "最近 90 天", days: 90 },
];

function applyPreset(days: number) {
  dateRange.value = [dayjs().subtract(days - 1, "day"), dayjs()];
}

/* ============================================================
 * ECharts 配置
 * ============================================================ */
// 请求量 + 失败数趋势
const requestTrendOption = computed(() => ({
  tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
  legend: { data: ["请求总数", "失败数", "成功率"], right: 0, top: 0, itemGap: 16 },
  grid: { left: 60, right: 60, top: 44, bottom: 40 },
  xAxis: {
    type: "category",
    data: trend.value?.dates ?? [],
    boundaryGap: false,
    axisLabel: { fontSize: 11, rotate: 0 },
  },
  yAxis: [
    {
      type: "value",
      name: "请求数",
      axisLabel: { fontSize: 11 },
      splitLine: { lineStyle: { color: "#f3f4f6", type: "dashed" } },
    },
    {
      type: "value",
      name: "成功率",
      min: 0,
      max: 100,
      axisLabel: { fontSize: 11, formatter: "{value}%" },
      splitLine: { show: false },
    },
  ],
  series: [
    {
      name: "请求总数",
      type: "line",
      smooth: true,
      data: trend.value?.requests ?? [],
      lineStyle: { color: "#3b82f6", width: 2 },
      itemStyle: { color: "#3b82f6" },
      areaStyle: {
        color: {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: "rgba(59,130,246,0.25)" },
            { offset: 1, color: "rgba(59,130,246,0.02)" },
          ],
        },
      },
    },
    {
      name: "失败数",
      type: "line",
      smooth: true,
      data: trend.value?.failures ?? [],
      lineStyle: { color: "#ef4444", width: 2 },
      itemStyle: { color: "#ef4444" },
    },
    {
      name: "成功率",
      type: "line",
      smooth: true,
      yAxisIndex: 1,
      data: trend.value?.successRates ?? [],
      lineStyle: { color: "#10b981", width: 2, type: "dashed" },
      itemStyle: { color: "#10b981" },
    },
  ],
}));

// 耗时趋势
const latencyTrendOption = computed(() => ({
  tooltip: { trigger: "axis", valueFormatter: (v: any) => `${v} ms` },
  legend: { data: ["平均耗时", "P95 耗时"], right: 0, top: 0 },
  grid: { left: 60, right: 30, top: 44, bottom: 40 },
  xAxis: {
    type: "category",
    data: trend.value?.dates ?? [],
    boundaryGap: false,
  },
  yAxis: {
    type: "value",
    name: "ms",
    splitLine: { lineStyle: { color: "#f3f4f6", type: "dashed" } },
  },
  series: [
    {
      name: "平均耗时",
      type: "line",
      smooth: true,
      data: trend.value?.avgTimes ?? [],
      lineStyle: { color: "#3b82f6", width: 2 },
      itemStyle: { color: "#3b82f6" },
    },
    {
      name: "P95 耗时",
      type: "line",
      smooth: true,
      data: trend.value?.p95Times ?? [],
      lineStyle: { color: "#f59e0b", width: 2 },
      itemStyle: { color: "#f59e0b" },
    },
  ],
}));

// 登录趋势
const loginTrendOption = computed(() => ({
  tooltip: { trigger: "axis" },
  legend: { data: ["登录数", "失败数"], right: 0, top: 0 },
  grid: { left: 60, right: 30, top: 44, bottom: 40 },
  xAxis: {
    type: "category",
    data: trend.value?.dates ?? [],
    boundaryGap: false,
  },
  yAxis: {
    type: "value",
    splitLine: { lineStyle: { color: "#f3f4f6", type: "dashed" } },
  },
  series: [
    {
      name: "登录数",
      type: "line",
      smooth: true,
      data: trend.value?.logins ?? [],
      lineStyle: { color: "#10b981", width: 2 },
      itemStyle: { color: "#10b981" },
      areaStyle: {
        color: {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: "rgba(16,185,129,0.2)" },
            { offset: 1, color: "rgba(16,185,129,0.02)" },
          ],
        },
      },
    },
    {
      name: "失败数",
      type: "line",
      smooth: true,
      data: trend.value?.loginFailures ?? [],
      lineStyle: { color: "#ef4444", width: 2 },
      itemStyle: { color: "#ef4444" },
    },
  ],
}));

// Top 操作失败率
const topFailRateOption = computed(() => {
  const top = [...topOps.value]
    .sort((a, b) => b.failRate - a.failRate)
    .slice(0, 10)
    .reverse();

  return {
    tooltip: {
      trigger: "axis",
      formatter: (params: any) => {
        const p = params[0];
        return `${p.name}<br/>失败率 ${p.value}%`;
      },
    },
    grid: { left: 200, right: 60, top: 20, bottom: 30 },
    xAxis: {
      type: "value",
      max: 100,
      axisLabel: { formatter: "{value}%" },
    },
    yAxis: {
      type: "category",
      data: top.map((t) => t.operationLabel),
      axisLabel: {
        fontSize: 11,
        width: 180,
        overflow: "truncate",
      },
    },
    series: [
      {
        type: "bar",
        data: top.map((t) => t.failRate),
        itemStyle: {
          color: (params: any) => {
            const v = params.value as number;
            if (v >= 20) return "#ef4444";
            if (v >= 5) return "#f59e0b";
            return "#10b981";
          },
          borderRadius: [0, 4, 4, 0],
        },
        label: {
          show: true,
          position: "right",
          formatter: "{c}%",
          fontSize: 11,
          color: "#6b7280",
        },
      },
    ],
  };
});

// Top 操作请求量
const topRequestsOption = computed(() => {
  const top = [...topOps.value]
    .sort((a, b) => b.totalCount - a.totalCount)
    .slice(0, 10)
    .reverse();

  return {
    tooltip: { trigger: "axis" },
    grid: { left: 200, right: 60, top: 20, bottom: 30 },
    xAxis: { type: "value" },
    yAxis: {
      type: "category",
      data: top.map((t) => t.operation),
      axisLabel: {
        fontSize: 11,
        width: 180,
        overflow: "truncate",
      },
    },
    series: [
      {
        type: "bar",
        data: top.map((t) => t.totalCount),
        itemStyle: {
          color: "#3b82f6",
          borderRadius: [0, 4, 4, 0],
        },
        label: {
          show: true,
          position: "right",
          fontSize: 11,
          color: "#6b7280",
        },
      },
    ],
  };
});

/* ============================================================
 * 生命周期
 * ============================================================ */
onMounted(async () => {
  await loadOperations();
  await loadAll();
});

watch(dateRange, loadAll);
watch(selectedOperation, loadAll);
const topOpColumns: TableProps["columns"] = [
  {
    title: "操作类型",
    dataIndex: "operation",
    ellipsis: true,
  },
  {
    title: "请求量",
    dataIndex: "totalCount",
    ellipsis: true,
    width: 120,
    render: (record: any) => {
      return record.toLocaleString();
    },
  },
  {
    title: "失败数",
    dataIndex: "failCount",
    ellipsis: true,
    width: 120,
    render: (record: any) => {
      return h(
        "span",
        {
          class: record >= 0 ? "text-rose-500" : "",
        },
        record,
      );
    },
  },
  {
    title: "失败率",
    dataIndex: "failRate",
    ellipsis: true,
    width: 120,
    render: (record: any) => {
      return h(
        Tag,
        {
          color: record >= 20 ? "red" : record >= 5 ? "orange" : "green",
        },
        `${record}%`,
      );
    },
  },
  {
    title: "平均耗时",
    dataIndex: "avgTimeMs",
    ellipsis: true,
    width: 120,
    render: (record: any) => `${record}ms`,
  },
  {
    title: "P95 耗时",
    dataIndex: "p95TimeMs",
    ellipsis: true,
    width: 120,
    render: (record: any) => `${record}ms`,
  },
];
</script>

<template>
  <PerfectScrollbar class="h-full">
    <div class="p-4 flex flex-col gap-2">
      <!-- 顶部工具栏 -->
      <a-card :bordered="false" class="shadow-sm">
        <div class="flex flex-wrap items-center gap-3">
          <a-range-picker
            v-model:value="dateRange"
            :allow-clear="false"
            format="YYYY-MM-DD"
            class="min-w-[260px]"
          />

          <a-select
            v-model:value="selectedOperation"
            placeholder="全部操作类型"
            allow-clear
            show-search
            class="min-w-[220px]"
            option-filter-prop="label"
          >
            <a-select-option v-for="op in operationList" :key="op" :value="op" :label="op">
              {{ op }}
            </a-select-option>
          </a-select>

          <div class="flex items-center gap-1.5">
            <a-button
              v-for="p in PRESET_RANGES"
              :key="p.days"
              size="small"
              @click="applyPreset(p.days)"
            >
              {{ p.label }}
            </a-button>
          </div>

          <div class="ml-auto flex items-center gap-2">
            <a-button :loading="aggregating" @click="handleAggregate">
              <template #icon><Icon icon="carbon:renew" /></template>
              手动聚合昨天
            </a-button>
            <a-button danger :loading="cleaning" @click="handleClean">
              <template #icon><Icon icon="carbon:trash-can" /></template>
              清理过期数据
            </a-button>
          </div>
        </div>
      </a-card>

      <!-- 概览卡片 -->
      <div v-if="overview" class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div
          class="rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div class="mb-2 flex items-center gap-2 text-xs text-slate-500">
            <Icon icon="carbon:api" /> 请求总数
          </div>
          <div class="text-2xl font-semibold text-slate-800 dark:text-slate-100">
            {{ overview.totalRequests.toLocaleString() }}
          </div>
          <div class="mt-1 text-xs text-slate-400">失败 {{ overview.totalFailures }}</div>
        </div>

        <div
          class="rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div class="mb-2 flex items-center gap-2 text-xs text-slate-500">
            <Icon icon="carbon:checkmark-outline" /> 成功率
          </div>
          <div
            class="text-2xl font-semibold"
            :class="
              overview.successRate >= 99
                ? 'text-emerald-500'
                : overview.successRate >= 95
                  ? 'text-amber-500'
                  : 'text-rose-500'
            "
          >
            {{ overview.successRate }}%
          </div>
          <div class="mt-1 text-xs text-slate-400">
            {{
              overview.successRate >= 99 ? "优秀" : overview.successRate >= 95 ? "正常" : "需关注"
            }}
          </div>
        </div>

        <div
          class="rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div class="mb-2 flex items-center gap-2 text-xs text-slate-500">
            <Icon icon="carbon:timer" /> 平均耗时
          </div>
          <div class="text-2xl font-semibold text-slate-800 dark:text-slate-100">
            {{ overview.avgTimeMs }}<span class="ml-0.5 text-xs">ms</span>
          </div>
          <div class="mt-1 text-xs text-slate-400">P95 {{ overview.p95TimeMs }} ms</div>
        </div>

        <div
          class="rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div class="mb-2 flex items-center gap-2 text-xs text-slate-500">
            <Icon icon="carbon:login" /> 登录
          </div>
          <div class="text-2xl font-semibold text-slate-800 dark:text-slate-100">
            {{ overview.totalLogins.toLocaleString() }}
          </div>
          <div class="mt-1 text-xs text-slate-400">
            独立用户 {{ overview.uniqueUsers }} · 失败 {{ overview.loginFailures }}
          </div>
        </div>
      </div>

      <!-- 趋势图 -->
      <a-card :bordered="false" class="shadow-sm">
        <template #title>
          <span class="text-sm font-medium">请求趋势</span>
        </template>
        <ECharts :option="requestTrendOption" height="320px" />
      </a-card>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <a-card :bordered="false" class="shadow-sm">
          <template #title>
            <span class="text-sm font-medium">耗时趋势</span>
          </template>
          <ECharts :option="latencyTrendOption" height="280px" />
        </a-card>

        <a-card :bordered="false" class="shadow-sm">
          <template #title>
            <span class="text-sm font-medium">登录趋势</span>
          </template>
          <ECharts :option="loginTrendOption" height="280px" />
        </a-card>
      </div>

      <!-- Top 操作 -->
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <a-card :bordered="false" class="shadow-sm">
          <template #title>
            <span class="text-sm font-medium">失败率 Top 10</span>
          </template>
          <ECharts :option="topFailRateOption" height="400px" />
        </a-card>

        <a-card :bordered="false" class="shadow-sm">
          <template #title>
            <span class="text-sm font-medium">请求量 Top 10</span>
          </template>
          <ECharts :option="topRequestsOption" height="400px" />
        </a-card>
      </div>

      <!-- 明细表 -->
      <a-card :bordered="false" class="shadow-sm">
        <template #title>
          <span class="text-sm font-medium">操作明细</span>
        </template>
        <a-table
          :data-source="topOps"
          :pagination="false"
          :loading="loading"
          row-key="operation"
          size="small"
          :columns="topOpColumns"
        >
        </a-table>
      </a-card>
    </div>
  </PerfectScrollbar>
</template>
