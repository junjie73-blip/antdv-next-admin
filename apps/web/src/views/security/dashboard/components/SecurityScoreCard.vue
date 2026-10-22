<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { CountTo, Tag } from '@antdv/common-ui';
import { cn } from '@antdv/shared/utils/cn';
import { useAppStore } from '@antdv/stores';
import * as echarts from 'echarts';
import { getSecurityScore } from '~/api/security';

defineOptions({ name: 'SecurityScoreCard' });

const appStore = useAppStore();
const isDark = computed(() => appStore.themeMode === 'dark');

// 安全评分数据
const totalScore = ref(86);
const dimensions = ref([
  { name: '身份认证', score: 92, status: 'excellent' as const },
  { name: '数据安全', score: 78, status: 'good' as const },
  { name: '访问控制', score: 85, status: 'good' as const },
  { name: '审计合规', score: 68, status: 'warning' as const },
]);
const trendData = ref<{ date: string; score: number }[]>([]);

// 样式类名
const containerClassName = cn('rounded-xl p-5');
const scoreValueClassName = cn('text-5xl leading-none font-black tabular-nums');
const dimensionCardClassName = cn(
  'flex items-center justify-between rounded-lg p-3 transition-all duration-200 hover:scale-[1.02]',
);

/** 状态颜色映射 */
function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    excellent: '#52c41a',
    good: '#1677ff',
    warning: '#faad14',
    critical: '#ff4d4f',
  };
  return map[status] ?? map.good;
}

/** 状态背景色 */
function getStatusBg(status: string): string {
  const map: Record<string, string> = {
    excellent: 'bg-success/10',
    good: 'bg-primary/10',
    warning: 'bg-warning/10',
    critical: 'bg-destructive/10',
  };
  return map[status] ?? map.good;
}

/** 评分等级文字 */
function getScoreLabel(score: number): string {
  if (score >= 90) return '优秀';
  if (score >= 75) return '良好';
  if (score >= 60) return '及格';
  return '较差';
}

/** 评分颜色 */
function getScoreColor(score: number): string {
  if (score >= 90) return 'text-success';
  if (score >= 75) return 'text-primary';
  if (score >= 60) return 'text-warning';
  return 'text-destructive';
}

// 趋势图相关
const chartRef = ref<HTMLDivElement>();
let chartInstance: echarts.ECharts | null = null;

function textColor() {
  return isDark.value ? '#d1d5db' : '#374151';
}
function subTextColor() {
  return isDark.value ? '#6b7280' : '#9ca3af';
}

function initTrendChart() {
  const el = chartRef.value;
  if (!el || el.offsetWidth === 0) return;

  chartInstance = echarts.init(el, isDark.value ? 'dark' : undefined);
  chartInstance.setOption({
    grid: { left: 0, right: 0, top: 8, bottom: 20 },
    xAxis: {
      type: 'category',
      data: trendData.value.map((d) => d.date),
      axisLabel: {
        color: subTextColor(),
        fontSize: 10,
        interval: 4,
      },
      axisLine: { lineStyle: { color: isDark.value ? '#374151' : '#e5e7eb' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 50,
      max: 100,
      axisLabel: { show: false },
      splitLine: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        type: 'line',
        data: trendData.value.map((d) => d.score),
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#1677ff', width: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(22,119,255,0.25)' },
            { offset: 1, color: 'rgba(22,119,255,0.01)' },
          ]),
        },
      },
    ],
    animationDuration: 1200,
  });
}

onMounted(async () => {
  try {
    const res = await getSecurityScore();
    const data = res?.data ?? res;
    totalScore.value = data.totalScore;
    dimensions.value = data.dimensions;
    trendData.value = data.trend;
  } catch {
    // 使用默认值
  }
  initTrendChart();
});
watch(isDark, () => {
  if (chartInstance) {
    chartInstance.dispose();
    initTrendChart();
  }
});
</script>

<template>
  <div :class="cn(containerClassName, 'border-border bg-card')">
    <!-- 标题 -->
    <div class="mb-4 flex items-center justify-between">
      <div>
        <h3 class="text-base font-semibold text-foreground">安全评分</h3>
        <p class="mt-0.5 text-xs text-muted-foreground">
          基于多维度安全指标综合评估
        </p>
      </div>
      <Tag
        :color="
          totalScore >= 80 ? 'green' : totalScore >= 60 ? 'orange' : 'red'
        "
        class="text-xs"
      >
        {{ getScoreLabel(totalScore) }}
      </Tag>
    </div>

    <!-- 主分数 + 趋势图 -->
    <div class="mb-5 flex items-center gap-6">
      <!-- 圆形进度 -->
      <div class="relative shrink-0">
        <svg
          :width="120"
          :height="120"
          viewBox="0 0 120 120"
          class="-rotate-90"
        >
          <!-- 背景圆 -->
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            :stroke="isDark ? '#374151' : '#e5e7eb'"
            stroke-width="10"
          />
          <!-- 进度圆 -->
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            :stroke="getScoreColor(totalScore)"
            stroke-width="10"
            :stroke-dasharray="`${(totalScore / 100) * 314} 314`"
            stroke-linecap="round"
            class="transition-all duration-1000 ease-out"
          />
        </svg>
        <div
          class="absolute inset-0 flex rotate-0 flex-col items-center justify-center"
        >
          <CountTo
            :end-val="totalScore"
            :class="cn(scoreValueClassName, getScoreColor(totalScore))"
            :duration="1500"
          />
          <span class="-mt-1 text-[10px] text-muted-foreground">/ 100</span>
        </div>
      </div>

      <!-- 趋势图 -->
      <div class="h-[120px] flex-1">
        <div ref="chartRef" class="h-full w-full"></div>
      </div>
    </div>

    <!-- 维度列表 -->
    <div class="grid grid-cols-2 gap-2.5">
      <div
        v-for="dim in dimensions"
        :key="dim.name"
        :class="cn(dimensionCardClassName, getStatusBg(dim.status))"
      >
        <span class="text-sm text-muted-foreground">{{ dim.name }}</span>
        <div class="flex items-center gap-2">
          <span
            :class="
              cn('text-lg font-bold tabular-nums', getScoreColor(dim.score))
            "
            >{{ dim.score }}</span>
          <div
            class="h-1.5 w-1.5 rounded-full"
            :style="{ backgroundColor: getStatusColor(dim.status) }"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>
