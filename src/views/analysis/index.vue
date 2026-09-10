<script setup lang="ts">
import type { Ref } from "vue";
import { Icon } from "@iconify/vue";
import { useEventListener } from "@vueuse/core";
import { message } from "antdv-next";
import * as echarts from "echarts";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useAppStore } from "@/stores/modules/app";
import { cn } from "@/utils/cn";
import {
  getActivityTrend,
  getDashboardKpi,
  getErrorRateTrend,
  getModuleRank,
  getResourceUsage,
  getSystemHealth,
  getTrafficDistribution,
  getUserJourney,
} from "@/api/system";

defineOptions({ name: "DashboardAnalysis" });
const appStore = useAppStore();

// ========== 主题相关 ==========
const isDark = computed(() => appStore.themeMode === "dark");
const currentRange = ref<"today" | "7d" | "30d">("7d");

// ========== 图表实例管理 ==========
const charts = new Map<string, echarts.ECharts>();

// ECharts DOM 引用
const mainTrendRef = ref<HTMLDivElement>();
const trafficDistRef = ref<HTMLDivElement>();
const systemHealthRef = ref<HTMLDivElement>();
const resourceRadarRef = ref<HTMLDivElement>();
const activityHeatmapRef = ref<HTMLDivElement>();
const userJourneyRef = ref<HTMLDivElement>();
const moduleRankRef = ref<HTMLDivElement>();

// ========== 样式类名（数据分析） ==========
const analyticsCardClassName = cn(
  "rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900",
  "shadow-sm transition-all duration-300 hover:shadow-md",
);
const sectionTitleClassName = cn("text-base font-semibold text-gray-800 dark:text-gray-200 mb-4");
// ========== 各区块 loading 状态 ==========
const kpiLoading = ref(false);
const mainTrendLoading = ref(false);
const trafficDistLoading = ref(false);
const systemHealthLoading = ref(false);
const resourceRadarLoading = ref(false);
const activityHeatmapLoading = ref(false);
const userJourneyLoading = ref(false);
const moduleRankLoading = ref(false);
// ═══════════════════════════════════════════
// 📈 数据分析图表数据
// ═══════════════════════════════════════════

const kpiList = ref<any[]>([]);
async function loadKpi() {
  try {
    const res = await getDashboardKpi();
    kpiList.value = res?.data ?? res ?? [];
    kpiLoading.value = false;
  } catch (e) {
    console.warn("加载 KPI 失败", e);
    kpiLoading.value = false;
  }
}
// ECharts 主题工具函数
function textColor() {
  return isDark.value ? "#d1d5db" : "#374151";
}
function subTextColor() {
  return isDark.value ? "#6b7280" : "#9ca3af";
}
function borderColor() {
  return isDark.value ? "#374151" : "#e5e7eb";
}
function axisLineColor() {
  return isDark.value ? "#4b5563" : "#d1d5db";
}
function tooltipBg() {
  return isDark.value ? "rgba(31,41,55,0.96)" : "rgba(255,255,255,0.96)";
}

function baseOption(extra: Record<string, any> = {}): Record<string, any> {
  return {
    backgroundColor: "transparent",
    tooltip: {
      backgroundColor: tooltipBg(),
      borderColor: borderColor(),
      textStyle: { color: textColor(), fontSize: 13 },
      extraCssText: "border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.1);",
    },
    ...extra,
  };
}

function gradient(colors: [string, string], vertical = true) {
  return new echarts.graphic.LinearGradient(0, 0, vertical ? 0 : 1, vertical ? 1 : 0, [
    { offset: 0, color: colors[0] },
    { offset: 1, color: colors[1] },
  ]);
}

const PALETTE = {
  primary: "#1677ff",
  success: "#52c41a",
  warning: "#faad14",
  danger: "#ff4d4f",
  info: "#722ed1",
  cyan: "#13c2c2",
};

// Chart 1: 系统活动趋势（主图）
async function initMainTrend() {
  const el = mainTrendRef.value;
  if (!el) return;
  const instance = echarts.init(el, isDark.value ? "dark" : undefined);
  charts.set("mainTrend", instance);

  let trendData = { categories: [], pv: [], uv: [], apiCalls: [] };
  mainTrendLoading.value = true;
  try {
    const res = await getActivityTrend(currentRange.value);
    trendData = res?.data ?? res ?? trendData;
  } catch (e) {
    console.warn("加载活动趋势失败", e);
  } finally {
    mainTrendLoading.value = false;
  }

  instance.setOption(
    baseOption({
      legend: {
        data: ["页面访问(PV)", "独立访客(UV)", "API调用"],
        top: 0,
        right: 0,
        textStyle: { color: subTextColor(), fontSize: 12 },
      },
      grid: { left: "3%", right: "4%", top: "36px", bottom: "8%", containLabel: true },
      xAxis: {
        type: "category",
        data: trendData.categories,
        boundaryGap: false,
        axisLine: { lineStyle: { color: axisLineColor() } },
        axisLabel: { color: subTextColor(), fontSize: 11 },
        axisTick: { show: false },
      },
      yAxis: [
        {
          type: "value",
          name: "访问量",
          nameTextStyle: { color: subTextColor(), fontSize: 11 },
          axisLabel: { color: subTextColor(), fontSize: 11 },
          splitLine: { lineStyle: { color: borderColor(), type: "dashed", opacity: 0.5 } },
        },
        {
          type: "value",
          name: "API",
          nameTextStyle: { color: subTextColor(), fontSize: 11 },
          axisLabel: {
            color: subTextColor(),
            fontSize: 11,
            formatter: (v: number) => `${v / 1000}k`,
          },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: "页面访问(PV)",
          type: "line",
          data: trendData.pv,
          smooth: true,
          symbol: "none",
          lineStyle: { color: PALETTE.primary, width: 2.5 },
          areaStyle: { color: gradient(["rgba(22,119,255,0.18)", "rgba(22,119,255,0.01)"]) },
        },
        {
          name: "独立访客(UV)",
          type: "line",
          data: trendData.uv,
          smooth: true,
          symbol: "none",
          lineStyle: { color: PALETTE.success, width: 2 },
          areaStyle: { color: gradient(["rgba(82,196,26,0.12)", "rgba(82,196,26,0.01)"]) },
        },
        {
          name: "API调用",
          type: "bar",
          yAxisIndex: 1,
          data: trendData.apiCalls,
          barWidth: 10,
          barGap: "-100%",
          itemStyle: {
            borderRadius: [3, 3, 0, 0],
            color: gradient(["rgba(114,46,209,0.6)", "rgba(114,46,209,0.08)"]),
          },
        },
      ],
      animationDuration: 1200,
    }),
  );
}

// Chart 2: 流量来源分布
async function initTrafficDist() {
  const el = trafficDistRef.value;
  if (!el) return;
  const instance = echarts.init(el, isDark.value ? "dark" : undefined);
  charts.set("trafficDist", instance);
  trafficDistLoading.value = true;
  let data: any[] = [];
  try {
    const res = await getTrafficDistribution();
    data = res?.data ?? res ?? [];
  } catch (e) {
    console.warn("加载流量分布失败", e);
  } finally {
    trafficDistLoading.value = false;
  }

  instance.setOption(
    baseOption({
      tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
      legend: {
        orient: "vertical",
        right: "2%",
        top: "center",
        textStyle: { color: subTextColor(), fontSize: 12 },
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 14,
        icon: "circle",
      },
      series: [
        {
          type: "pie",
          radius: ["42%", "72%"],
          center: ["38%", "50%"],
          padAngle: 2,
          itemStyle: {
            borderRadius: 6,
            borderColor: isDark.value ? "#111827" : "#fff",
            borderWidth: 2,
          },
          label: { show: false },
          emphasis: {
            label: { show: true, fontSize: 14, fontWeight: "bold", color: textColor() },
            scaleSize: 8,
          },
          data,
          color: [
            PALETTE.primary,
            PALETTE.success,
            PALETTE.warning,
            PALETTE.info,
            PALETTE.cyan,
            PALETTE.danger,
          ],
        },
      ],
    }),
  );
}

// Chart 3: 系统健康仪表盘
async function initSystemHealth() {
  const el = systemHealthRef.value;
  if (!el) return;
  const instance = echarts.init(el, isDark.value ? "dark" : undefined);
  charts.set("systemHealth", instance);
  systemHealthLoading.value = true;
  let health = 0;
  try {
    const res = await getSystemHealth();
    health = (res?.data ?? res)?.health ?? 0;
  } catch (e) {
    console.warn("加载系统健康度失败", e);
  } finally {
    systemHealthLoading.value = false;
  }
  instance.setOption(
    baseOption({
      series: [
        {
          type: "gauge",
          startAngle: 210,
          endAngle: -30,
          radius: "92%",
          min: 0,
          max: 100,
          axisLine: {
            lineStyle: {
              width: 14,
              color: [
                [0.35, PALETTE.success],
                [0.65, PALETTE.warning],
                [1, PALETTE.danger],
              ],
            },
          },
          pointer: { length: "58%", width: 4, itemStyle: { color: "auto" } },
          axisTick: { length: 6, lineStyle: { color: "auto", width: 1.5 } },
          splitLine: { length: 12, lineStyle: { color: "auto", width: 2 } },
          axisLabel: { color: subTextColor(), distance: 18, fontSize: 10 },
          detail: {
            valueAnimation: true,
            formatter: "{value}%",
            color: textColor(),
            fontSize: 26,
            fontWeight: 700,
            offsetCenter: [0, "55%"],
          },
          title: { show: false },
          data: [{ value: health }],
          animationDuration: 1800,
        },
      ],
    }),
  );
}

// Chart 4: 资源使用雷达图
async function initResourceRadar() {
  const el = resourceRadarRef.value;
  if (!el) return;
  const instance = echarts.init(el, isDark.value ? "dark" : undefined);
  charts.set("resourceRadar", instance);
  resourceRadarLoading.value = true;
  let usage = { indicators: [], current: [], peak: [] };
  try {
    const res = await getResourceUsage();
    usage = res?.data ?? res ?? usage;
  } catch (e) {
    console.warn("加载资源使用失败", e);
  } finally {
    resourceRadarLoading.value = false;
  }

  instance.setOption(
    baseOption({
      legend: {
        data: ["当前", "峰值"],
        bottom: 0,
        textStyle: { color: subTextColor(), fontSize: 12 },
      },
      radar: {
        indicator: usage.indicators,
        axisName: { color: subTextColor(), fontSize: 11 },
        splitArea: {
          areaStyle: {
            color: [
              isDark.value ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
              isDark.value ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
            ],
          },
        },
        splitLine: { lineStyle: { color: borderColor(), opacity: 0.4 } },
        axisLine: { lineStyle: { color: borderColor(), opacity: 0.4 } },
      },
      series: [
        {
          name: "当前",
          type: "radar",
          data: [{ value: usage.current, name: "当前" }],
          symbol: "circle",
          symbolSize: 5,
          lineStyle: { color: PALETTE.primary, width: 2 },
          areaStyle: { color: "rgba(22,119,255,0.18)" },
          itemStyle: { color: PALETTE.primary },
        },
        {
          name: "峰值",
          type: "radar",
          data: [{ value: usage.peak, name: "峰值" }],
          symbol: "circle",
          symbolSize: 4,
          lineStyle: { color: PALETTE.danger, width: 1.5, type: "dashed" },
          areaStyle: { color: "rgba(255,77,79,0.06)" },
          itemStyle: { color: PALETTE.danger },
        },
      ],
    }),
  );
}

// ========== API 错误率趋势 ==========
async function initActivityHeatmap() {
  const el = activityHeatmapRef.value;
  if (!el) return;
  const instance = echarts.init(el, isDark.value ? "dark" : undefined);
  charts.set("activityHeatmap", instance);

  let data = { hours: [], errorRates: [], errors4xx: [], errors5xx: [] };
  activityHeatmapLoading.value = true;
  try {
    const res = await getErrorRateTrend();
    data = res?.data ?? res ?? data;
  } catch (e) {
    console.warn("加载错误率失败", e);
  } finally {
    activityHeatmapLoading.value = false;
  }

  instance.setOption(
    baseOption({
      legend: {
        data: ["总错误率", "4xx 客户端错误", "5xx 服务端错误"],
        top: 0,
        textStyle: { color: subTextColor(), fontSize: 10 },
      },
      grid: { left: "3%", right: "4%", top: "32px", bottom: "10%", containLabel: true },
      xAxis: {
        type: "category",
        data: data.hours,
        axisLabel: { color: subTextColor(), fontSize: 9, interval: 2 },
        axisLine: { lineStyle: { color: borderColor() } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        name: "错误率 (%)",
        nameTextStyle: { color: subTextColor(), fontSize: 10 },
        axisLabel: { color: subTextColor(), fontSize: 9, formatter: "{value}%" },
        splitLine: { lineStyle: { color: borderColor(), type: "dashed", opacity: 0.4 } },
      },
      series: [
        {
          name: "总错误率",
          type: "line",
          data: data.errorRates,
          smooth: true,
          symbol: "none",
          lineStyle: { color: PALETTE.danger, width: 2 },
          areaStyle: { color: gradient(["rgba(255,77,79,0.15)", "rgba(255,77,79,0.01)"]) },
        },
        {
          name: "4xx 客户端错误",
          type: "bar",
          data: data.errors4xx,
          barWidth: 6,
          itemStyle: { color: PALETTE.warning, borderRadius: [2, 2, 0, 0] },
        },
        {
          name: "5xx 服务端错误",
          type: "bar",
          data: data.errors5xx,
          barWidth: 6,
          itemStyle: { color: PALETTE.danger, borderRadius: [2, 2, 0, 0] },
        },
      ],
      animationDuration: 1200,
    }),
  );
}

// Chart 6: 用户行为漏斗
async function initUserJourney() {
  const el = userJourneyRef.value;
  if (!el) return;
  const instance = echarts.init(el, isDark.value ? "dark" : undefined);
  charts.set("userJourney", instance);
  userJourneyLoading.value = true;
  let stages: any[] = [];
  try {
    const res = await getUserJourney();
    stages = res?.data ?? res ?? [];
  } catch (e) {
    console.warn("加载用户行为失败", e);
  } finally {
    userJourneyLoading.value = false;
  }

  const total = stages[0]?.value ?? 1;

  instance.setOption(
    baseOption({
      tooltip: {
        formatter: (params: any) =>
          `<b>${params.name}</b><br/>人数: ${params.value}<br/>转化率: ${((params.value / total) * 100).toFixed(1)}%`,
      },
      series: [
        {
          type: "funnel",
          left: "12%",
          top: 16,
          bottom: 16,
          width: "76%",
          sort: "descending",
          gap: 3,
          label: {
            show: true,
            position: "inside",
            formatter: "{b}\n{c}",
            color: "#fff",
            fontSize: 12,
            fontWeight: 500,
          },
          labelLine: { show: false },
          itemStyle: {
            borderColor: isDark.value ? "#111827" : "#fff",
            borderWidth: 2,
            shadowBlur: 8,
            shadowColor: "rgba(0,0,0,0.08)",
          },
          data: stages,
          color: [PALETTE.primary, "#4096ff", "#69b1ff", "#91caff", "#bae0fe"],
          animationDuration: 1500,
        },
      ],
    }),
  );
}

// Chart 7: 模块使用排行（动态）
let moduleRankTimer: ReturnType<typeof setInterval> | null = null;

async function initModuleRank() {
  const el = moduleRankRef.value;
  if (!el) return;
  const instance = echarts.init(el, isDark.value ? "dark" : undefined);
  charts.set("moduleRank", instance);

  async function update() {
    let sorted: any[] = [];
    moduleRankLoading.value = true;
    try {
      const res = await getModuleRank();
      sorted = res?.data ?? res ?? [];
    } catch (e) {
      console.warn("加载模块排行失败", e);
    } finally {
      moduleRankLoading.value = false;
    }

    instance.setOption({
      grid: { left: "2%", right: "8%", top: "2%", bottom: "2%", containLabel: true },
      xAxis: {
        type: "value",
        axisLabel: { color: subTextColor(), fontSize: 10 },
        splitLine: { lineStyle: { color: borderColor(), type: "dashed", opacity: 0.4 } },
      },
      yAxis: {
        type: "category",
        data: sorted.map((d) => d.name),
        axisLabel: { color: textColor(), fontSize: 12 },
        axisTick: { show: false },
        axisLine: { show: false },
        inverse: true,
      },
      series: [
        {
          type: "bar",
          data: sorted.map((d) => ({
            value: d.value,
            itemStyle: {
              color: gradient([PALETTE.primary, "rgba(22,119,255,0.25)"], false),
              borderRadius: [0, 4, 4, 0],
            },
          })),
          barWidth: 16,
          label: {
            show: true,
            position: "right",
            color: subTextColor(),
            fontSize: 11,
            formatter: "{c}",
          },
          animationDuration: 800,
          animationEasing: "cubicInOut",
        },
      ],
    });
  }

  await update();
  moduleRankTimer = setInterval(update, 15000); // 每 15 秒刷新
}

// 导出报告
const CHART_EXPORT_CONFIG: { name: string; key: string }[] = [
  { name: "系统活动趋势", key: "mainTrend" },
  { name: "流量来源分布", key: "trafficDist" },
  { name: "系统健康度", key: "systemHealth" },
  { name: "资源使用概况", key: "resourceRadar" },
  { name: "用户活跃时段", key: "activityHeatmap" },
  { name: "用户行为漏斗", key: "userJourney" },
  { name: "模块使用热度", key: "moduleRank" },
];

function handleExportReport() {
  if (charts.size === 0) {
    message.warning("图表尚未加载完成，请稍后再试");
    return;
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const padding = 40;
  const chartGap = 30;
  const labelHeight = 36;
  const headerHeight = 100;

  let totalHeight = padding + headerHeight + padding;
  for (const item of CHART_EXPORT_CONFIG) {
    totalHeight += labelHeight + chartGap;
    const instance = charts.get(item.key);
    if (instance) {
      const el = instance.getDom();
      totalHeight += Math.max(Number(el.offsetHeight) || 400, 400);
    } else {
      totalHeight += 400;
    }
  }
  totalHeight += padding;

  canvas.width = 1400;
  canvas.height = totalHeight * 2;
  ctx.scale(2, 2);

  ctx.fillStyle = isDark.value ? "#111827" : "#ffffff";
  ctx.fillRect(0, 0, canvas.width / 2, totalHeight);

  ctx.fillStyle = isDark.value ? "#f9fafb" : "#111827";
  ctx.font = 'bold 28px -apple-system, "SF Pro Text", sans-serif';
  ctx.fillText("数据可视化报告", padding, padding + 32);
  ctx.fillStyle = isDark.value ? "#9ca3af" : "#6b7280";
  ctx.font = '14px -apple-system, "SF Pro Text", sans-serif';
  ctx.fillText(`生成时间：${new Date().toLocaleString("zh-CN")}`, padding, padding + 58);
  ctx.fillStyle = isDark.value ? "#374151" : "#e5e7eb";
  ctx.fillRect(padding, padding + 70, canvas.width / 2 - padding * 2, 1);

  let offsetY = padding + headerHeight + padding;

  for (const item of CHART_EXPORT_CONFIG) {
    ctx.fillStyle = isDark.value ? "#d1d5db" : "#374151";
    ctx.font = 'bold 16px -apple-system, "SF Pro Text", sans-serif';
    ctx.fillText(item.name, padding, offsetY + 24);
    offsetY += labelHeight;

    const instance = charts.get(item.key);
    if (instance) {
      try {
        const dataUrl = instance.getDataURL({
          type: "png",
          pixelRatio: 2,
          backgroundColor: isDark.value ? "#1f2937" : "#ffffff",
        });
        const img = new Image();
        img.onload = () => {
          const ratio = (canvas.width / 2 - padding * 2) / img.width;
          const drawH = img.height * ratio;
          ctx.drawImage(img, padding, offsetY, canvas.width / 2 - padding * 2, drawH);
          offsetY += drawH + chartGap;
          if (item === CHART_EXPORT_CONFIG[CHART_EXPORT_CONFIG.length - 1]) {
            triggerDownload();
          }
        };
        img.onerror = () => {
          offsetY += 300 + chartGap;
          checkLast();
        };
        img.src = dataUrl;
      } catch {
        offsetY += 300 + chartGap;
        checkLast();
      }
    } else {
      offsetY += 300 + chartGap;
      checkLast();
    }

    if (item !== CHART_EXPORT_CONFIG[CHART_EXPORT_CONFIG.length - 1]) {
      ctx.fillStyle = isDark.value ? "#374151" : "#e5e7eb";
      ctx.fillRect(padding, offsetY - chartGap / 2, canvas.width / 2 - padding * 2, 1);
    }
  }

  let doneCount = 0;
  function checkLast() {
    doneCount++;
    if (doneCount >= CHART_EXPORT_CONFIG.length) triggerDownload();
  }

  function triggerDownload() {
    const link = document.createElement("a");
    link.download = `数据可视化报告_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL("image/png", 1.0);
    link.click();
    message.success("报告导出成功！");
  }
}

// ========== 生命周期 ==========

function safeInit(
  name: string,
  refEl: Ref<HTMLDivElement | undefined>,
  initFn: (el: HTMLDivElement) => void,
) {
  const el = refEl.value;
  if (!el || charts.has(name)) return;

  if (el.offsetWidth > 0 && el.offsetHeight > 0) {
    initFn(el);
    return;
  }

  let cleaned = false;
  const observer = new ResizeObserver((entries) => {
    if (cleaned) return;
    for (const entry of entries) {
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        cleaned = true;
        observer.disconnect();
        const target = refEl.value;
        if (target && !charts.has(name)) {
          initFn(target);
        }
        break;
      }
    }
  });
  observer.observe(el);

  setTimeout(() => {
    if (!cleaned && !charts.has(name)) {
      cleaned = true;
      observer.disconnect();
      const target = refEl.value;
      if (target) initFn(target);
    }
  }, 3000);
}

function initAllCharts() {
  safeInit("mainTrend", mainTrendRef, () => initMainTrend());
  safeInit("trafficDist", trafficDistRef, () => initTrafficDist());
  safeInit("systemHealth", systemHealthRef, () => initSystemHealth());
  safeInit("resourceRadar", resourceRadarRef, () => initResourceRadar());
  safeInit("activityHeatmap", activityHeatmapRef, () => initActivityHeatmap());
  safeInit("userJourney", userJourneyRef, () => initUserJourney());
  safeInit("moduleRank", moduleRankRef, () => initModuleRank());
}
// BorderBeam 颜色映射：根据 KPI 色系返回光束颜色
function borderBeamColor(color: string): string {
  const map: Record<string, string> = {
    blue: "#1677ff",
    emerald: "#52c41a",
    violet: "#722ed1",
    amber: "#faad14",
  };
  return map[color] || "#1677ff";
}

// 图标容器样式
function kpiIconWrap(color: string): string | undefined {
  const map: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
  };
  return map[color] || map.blue;
}
function disposeAll() {
  charts.forEach((c) => c.dispose());
  charts.clear();
}

useEventListener(window, "resize", () => charts.forEach((c) => c.resize()));

onMounted(async () => {
  await loadKpi();
  nextTick(() => initAllCharts());
});
watch(currentRange, async () => {
  const instance = charts.get("mainTrend");
  if (instance) {
    instance.dispose();
    charts.delete("mainTrend");
  }
  await initAllCharts();
});

onBeforeUnmount(() => {
  if (moduleRankTimer) {
    clearInterval(moduleRankTimer);
    moduleRankTimer = null;
  }
  disposeAll();
});
</script>

<template>
  <div>
    <!-- 页面标题 -->
    <div class="flex items-center justify-between mb-2">
      <div>
        <h1 class="text-2xl font-bold text-gray-800 dark:text-white">数据分析</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">系统数据分析与可视化</p>
      </div>
      <a-space>
        <a-segmented
          v-model:value="currentRange"
          :options="[
            { label: '今日', value: 'today' },
            { label: '近7天', value: '7d' },
            { label: '近30天', value: '30d' },
          ]"
          size="small"
        />
        <a-button size="small" @click="handleExportReport">
          <template #icon>
            <Icon icon="carbon:download" />
          </template>
          导出报告
        </a-button>
      </a-space>
    </div>

    <!-- 数据分析内容 -->
    <div class="space-y-8">
      <!-- KPI 统计卡片区 -->
      <a-row :gutter="[16, 16]" class="mb-6">
        <a-col v-for="i in 4" v-if="kpiLoading" :key="`sk-${i}`" :xs="24" :sm="12" :lg="6">
          <div
            class="rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-5"
          >
            <a-skeleton active :paragraph="{ rows: 2 }" />
          </div>
        </a-col>
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
                    'rounded-lg bg-white dark:bg-gray-900',
                    'p-5 transition-all duration-300',
                    'hover:shadow-lg',
                  )
                "
              >
                <div class="flex items-start justify-between gap-4">
                  <!-- 左侧：图标 + 数据 -->
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

                  <!-- 右侧：图标 -->
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

      <!-- 主趋势图：全宽 -->
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

      <!-- 第二行：分布 + 仪表盘 -->
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

      <!-- 第三行：雷达图 + 热力图 -->
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

      <!-- 第四行：漏斗 + 排行榜 -->
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
              <a-tag color="blue" class="text-[11px]"> 实时更新 </a-tag>
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
