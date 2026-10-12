<script setup lang="ts">
import type { EChartsOption } from 'echarts';

import { computed, ref } from 'vue';

import { cn } from '@antdv/shared/cn';
import { message } from 'antdv-next';
import * as echarts from 'echarts';
import { useAppStore } from '~/stores/modules/app';

defineOptions({ name: 'ComponentsChart' });

const containerClassName = cn('space-y-6');
const tipClassName = cn('mb-4 text-sm text-gray-500 dark:text-gray-400');

const appStore = useAppStore();
// 封装的 ECharts 组件没有 theme 入参，明暗适配沿用「分析面板」的做法：
// 颜色全部读 option，主题切换时 computed 重算、组件内部 deep watch 会 notMerge 重绘。
const isDark = computed(() => appStore.resolvedTheme === 'dark');

function textColor() {
  return isDark.value ? '#d1d5db' : '#374151';
}
function subTextColor() {
  return isDark.value ? '#6b7280' : '#9ca3af';
}
function borderColor() {
  return isDark.value ? '#374151' : '#e5e7eb';
}
function axisLineColor() {
  return isDark.value ? '#4b5563' : '#d1d5db';
}
function tooltipBg() {
  return isDark.value ? 'rgba(31,41,55,0.96)' : 'rgba(255,255,255,0.96)';
}

function baseOption(extra: Record<string, unknown> = {}): EChartsOption {
  return {
    backgroundColor: 'transparent',
    tooltip: {
      backgroundColor: tooltipBg(),
      borderColor: borderColor(),
      textStyle: { color: textColor(), fontSize: 13 },
      ...extra.tooltip,
    },
    ...extra,
  } as EChartsOption;
}

function gradient(colors: [string, string], vertical = true) {
  return new echarts.graphic.LinearGradient(
    0,
    0,
    vertical ? 0 : 1,
    vertical ? 1 : 0,
    [
      { offset: 0, color: colors[0] },
      { offset: 1, color: colors[1] },
    ],
  );
}

const PALETTE = {
  primary: '#1677ff',
  success: '#52c41a',
  warning: '#faad14',
  danger: '#ff4d4f',
  info: '#722ed1',
  cyan: '#13c2c2',
};

// ═══════════════════════════════════════════
// 1. 折线图：数据全部是本页常量，「刷新数据」换一组内置样例
// ═══════════════════════════════════════════

const lineDatasets = [
  {
    months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月'],
    visits: [820, 932, 901, 1290, 1330, 1520, 1468, 1890],
    orders: [120, 132, 101, 134, 190, 230, 210, 286],
  },
  {
    months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月'],
    visits: [1500, 1230, 1120, 1540, 1680, 1420, 1980, 2310],
    orders: [320, 260, 210, 290, 405, 318, 460, 512],
  },
  {
    months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月'],
    visits: [610, 720, 890, 1150, 980, 1210, 1640, 2050],
    orders: [88, 120, 156, 204, 175, 232, 298, 371],
  },
];

const lineDatasetIndex = ref(0);

function refreshLineData() {
  lineDatasetIndex.value = (lineDatasetIndex.value + 1) % lineDatasets.length;
  message.success(`已切换到第 ${lineDatasetIndex.value + 1} 组内置数据`);
}

const lineOption = computed<EChartsOption>(() => {
  const data = lineDatasets[lineDatasetIndex.value]!;
  return baseOption({
    legend: {
      data: ['访问量', '订单量'],
      top: 0,
      textStyle: { color: subTextColor(), fontSize: 12 },
    },
    grid: {
      left: '3%',
      right: '4%',
      top: '36px',
      bottom: '8%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.months,
      axisLine: { lineStyle: { color: axisLineColor() } },
      axisLabel: { color: subTextColor(), fontSize: 11 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: subTextColor(), fontSize: 11 },
      splitLine: {
        lineStyle: { color: borderColor(), type: 'dashed', opacity: 0.5 },
      },
    },
    series: [
      {
        name: '访问量',
        type: 'line',
        data: data.visits,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: PALETTE.primary, width: 2.5 },
        itemStyle: { color: PALETTE.primary },
        areaStyle: {
          color: gradient(['rgba(22,119,255,0.18)', 'rgba(22,119,255,0.01)']),
        },
      },
      {
        name: '订单量',
        type: 'line',
        data: data.orders,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: PALETTE.success, width: 2 },
        itemStyle: { color: PALETTE.success },
        areaStyle: {
          color: gradient(['rgba(82,196,26,0.12)', 'rgba(82,196,26,0.01)']),
        },
      },
    ],
    animationDuration: 800,
  });
});

// ═══════════════════════════════════════════
// 2. 柱状图：开关切换 分组 / 堆叠
// ═══════════════════════════════════════════

const stacked = ref(false);

const barOption = computed<EChartsOption>(() => {
  const quarters = ['一季度', '二季度', '三季度', '四季度'];
  const seriesDefs = [
    { name: '线上渠道', data: [120, 132, 101, 134], color: PALETTE.primary },
    { name: '线下门店', data: [220, 182, 191, 234], color: PALETTE.success },
    { name: '分销批发', data: [150, 212, 201, 154], color: PALETTE.warning },
  ];
  return baseOption({
    legend: {
      data: seriesDefs.map((s) => s.name),
      top: 0,
      textStyle: { color: subTextColor(), fontSize: 12 },
    },
    grid: {
      left: '3%',
      right: '4%',
      top: '36px',
      bottom: '8%',
      containLabel: true,
    },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: {
      type: 'category',
      data: quarters,
      axisLine: { lineStyle: { color: axisLineColor() } },
      axisLabel: { color: subTextColor(), fontSize: 11 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      name: '销量',
      nameTextStyle: { color: subTextColor(), fontSize: 11 },
      axisLabel: { color: subTextColor(), fontSize: 11 },
      splitLine: {
        lineStyle: { color: borderColor(), type: 'dashed', opacity: 0.5 },
      },
    },
    series: seriesDefs.map((s) => ({
      name: s.name,
      type: 'bar' as const,
      stack: stacked.value ? 'total' : undefined,
      barMaxWidth: 32,
      data: s.data,
      itemStyle: {
        color: gradient([s.color, `${s.color}66`]),
        borderRadius: stacked.value ? 0 : [4, 4, 0, 0],
      },
      emphasis: { focus: 'series' as const },
    })),
    animationDuration: 600,
  });
});

// ═══════════════════════════════════════════
// 3. 饼图 / 环形：legend 可点选，label 用格式化模板
// ═══════════════════════════════════════════

const pieOption = computed<EChartsOption>(() =>
  baseOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} 人次 ({d}%)' },
    legend: {
      orient: 'vertical',
      right: '2%',
      top: 'center',
      textStyle: { color: subTextColor(), fontSize: 12 },
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 14,
      icon: 'circle',
    },
    series: [
      {
        name: '访问来源',
        type: 'pie',
        radius: ['42%', '72%'],
        center: ['38%', '50%'],
        avoidLabelOverlap: true,
        padAngle: 2,
        itemStyle: {
          borderRadius: 6,
          borderColor: isDark.value ? '#111827' : '#fff',
          borderWidth: 2,
        },
        label: {
          show: true,
          color: subTextColor(),
          fontSize: 11,
          formatter: '{b}\n{d}%',
        },
        labelLine: { lineStyle: { color: borderColor() } },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
            color: textColor(),
          },
          scaleSize: 8,
        },
        data: [
          { value: 3842, name: '直接访问' },
          { value: 2950, name: '搜索引擎' },
          { value: 1860, name: '外部链接' },
          { value: 1240, name: '社交媒体' },
          { value: 860, name: '邮件推广' },
        ],
        color: [
          PALETTE.primary,
          PALETTE.success,
          PALETTE.warning,
          PALETTE.info,
          PALETTE.cyan,
        ],
      },
    ],
  }),
);

// ═══════════════════════════════════════════
// 4. 组合图：柱 + 线，双 Y 轴（读侧最常见的诉求）
// ═══════════════════════════════════════════

const comboOption = computed<EChartsOption>(() => {
  const weeks = ['第1周', '第2周', '第3周', '第4周', '第5周', '第6周'];
  const sales = [4200, 5100, 4800, 6300, 7200, 6800];
  const growthRate = [8.2, 12.5, -3.1, 15.8, 9.4, -6.2];
  return baseOption({
    legend: {
      data: ['销售额', '环比增长率'],
      top: 0,
      textStyle: { color: subTextColor(), fontSize: 12 },
    },
    grid: {
      left: '3%',
      right: '4%',
      top: '40px',
      bottom: '8%',
      containLabel: true,
    },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: weeks,
      axisLine: { lineStyle: { color: axisLineColor() } },
      axisLabel: { color: subTextColor(), fontSize: 11 },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        name: '销售额 (元)',
        nameTextStyle: { color: subTextColor(), fontSize: 11 },
        axisLabel: { color: subTextColor(), fontSize: 11 },
        splitLine: {
          lineStyle: { color: borderColor(), type: 'dashed', opacity: 0.5 },
        },
        position: 'left',
      },
      {
        type: 'value',
        name: '增长率',
        nameTextStyle: { color: subTextColor(), fontSize: 11 },
        axisLabel: {
          color: subTextColor(),
          fontSize: 11,
          formatter: '{value}%',
        },
        splitLine: { show: false },
        position: 'right',
      },
    ],
    series: [
      {
        name: '销售额',
        type: 'bar',
        yAxisIndex: 0,
        data: sales,
        barMaxWidth: 36,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: gradient(['rgba(22,119,255,0.85)', 'rgba(22,119,255,0.25)']),
        },
      },
      {
        name: '环比增长率',
        type: 'line',
        yAxisIndex: 1,
        data: growthRate,
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { color: PALETTE.danger, width: 2.5 },
        itemStyle: { color: PALETTE.danger },
      },
    ],
    animationDuration: 800,
  });
});

// ═══════════════════════════════════════════
// 5. 加载与空数据：loading 走封装组件自带的 prop
// ═══════════════════════════════════════════

const chartLoading = ref(false);

function toggleChartLoading() {
  chartLoading.value = !chartLoading.value;
}

const loadingDemoOption = computed<EChartsOption>(() =>
  baseOption({
    grid: {
      left: '3%',
      right: '4%',
      top: '12%',
      bottom: '8%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: ['周一', '周二', '周三', '周四', '周五'],
      axisLine: { lineStyle: { color: axisLineColor() } },
      axisLabel: { color: subTextColor(), fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: subTextColor(), fontSize: 11 },
      splitLine: {
        lineStyle: { color: borderColor(), type: 'dashed', opacity: 0.5 },
      },
    },
    series: [
      {
        name: '任务数',
        type: 'bar',
        data: [32, 45, 28, 51, 39],
        barMaxWidth: 28,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: gradient([PALETTE.cyan, 'rgba(19,194,194,0.25)']),
        },
      },
    ],
  }),
);

const emptyOption = computed<EChartsOption>(() =>
  baseOption({
    grid: {
      left: '3%',
      right: '4%',
      top: '12%',
      bottom: '8%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: [],
      axisLine: { lineStyle: { color: axisLineColor() } },
      axisLabel: { color: subTextColor(), fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: subTextColor(), fontSize: 11 },
      splitLine: {
        lineStyle: { color: borderColor(), type: 'dashed', opacity: 0.5 },
      },
    },
    series: [{ name: '指标', type: 'line', data: [] }],
  }),
);
</script>

<template>
  <div :class="containerClassName">
    <a-alert show-icon type="info">
      <template #description>
        本页展示项目内封装的 ECharts 组件（
        <code>src/components/common/ECharts</code>
        ，经 unplugin-vue-components 自动注册，模板里直接写
        <code>&lt;ECharts /&gt;</code>
        即可），入参只有 option / height / loading
        三个。所有数据都是本页内置的静态样例数组，没有任何接口请求，可放心整页复制。
      </template>
    </a-alert>

    <a-card title="折线图 · 数据响应式" variant="borderless">
      <p :class="tipClassName">
        折线数据来自页内常量 datasets，点击「刷新数据」会整组替换 option ——
        封装组件内部对 option 做了 deep watch 并以 notMerge
        重绘，所以能直接看到重渲染效果。
      </p>
      <div class="mb-4">
        <a-button type="primary" @click="refreshLineData">
          刷新数据（当前第 {{ lineDatasetIndex + 1 }} 组）
        </a-button>
      </div>
      <ECharts :option="lineOption" height="320px" />
    </a-card>

    <a-card title="柱状图 · 分组 / 堆叠" variant="borderless">
      <p :class="tipClassName">
        同一个数据源，开关只改变 series 的 stack
        配置：关闭时三根柱子并排（分组）， 打开时叠加为一根（堆叠）。
      </p>
      <div class="mb-4 flex items-center gap-3">
        <a-switch
          v-model:checked="stacked"
          checked-children="堆叠"
          un-checked-children="分组"
        />
        <span class="text-sm text-gray-500 dark:text-gray-400">
          当前模式：<span class="font-medium">{{
            stacked ? '堆叠柱状图' : '分组柱状图'
          }}</span>
        </span>
      </div>
      <ECharts :option="barOption" height="320px" />
    </a-card>

    <a-card title="饼图 / 环形 · 图例交互" variant="borderless">
      <p :class="tipClassName">
        环形饼图：legend 支持点选（点击右侧图例可隐藏/恢复对应扇区），label
        用格式化模板显示「名称 + 百分比」 （<code>formatter: '{b} 换行 {d}%'</code>），tooltip 模板为
        <code>{ '{b}: {c} 人次 ({d}%)' }</code>
        。
      </p>
      <ECharts :option="pieOption" height="320px" />
    </a-card>

    <a-card title="组合图 · 双 Y 轴（柱 + 线）" variant="borderless">
      <p :class="tipClassName">
        读者最常问的场景：柱状（销售额）挂左轴、折线（环比增长率）通过
        <code>yAxisIndex: 1</code>
        挂右轴，右轴关掉 splitLine 避免网格线打架。
      </p>
      <ECharts :option="comboOption" height="320px" />
    </a-card>

    <a-card title="加载与空数据" variant="borderless">
      <p :class="tipClassName">
        封装组件自带 loading 入参（映射到 ECharts 的 showLoading/hideLoading
        遮罩，无需页面自己盖 Spin）； 空数据则传一份空数组的
        option，图表会正常渲染出坐标系骨架而不是白屏/坏画布。
      </p>
      <a-row :gutter="[16, 16]">
        <a-col :xs="24" :lg="12">
          <div class="mb-3">
            <a-button
              :type="chartLoading ? 'default' : 'primary'"
              @click="toggleChartLoading"
            >
              {{ chartLoading ? '隐藏 Loading' : '显示 Loading' }}
            </a-button>
          </div>
          <ECharts
            :option="loadingDemoOption"
            height="320px"
            :loading="chartLoading"
          />
        </a-col>
        <a-col :xs="24" :lg="12">
          <p class="mb-3 text-sm text-gray-500 dark:text-gray-400">
            下方为空数据集（xAxis.data 与 series.data 均为 []）：
          </p>
          <ECharts :option="emptyOption" height="320px" />
        </a-col>
      </a-row>
    </a-card>
  </div>
</template>
