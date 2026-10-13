<script setup lang="ts">
import type { Ref } from 'vue';

import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';

import { cn } from '@antdv/shared/cn';
import { Icon } from '@iconify/vue';
import { useEventListener } from '@vueuse/core';
import { Button as AButton, Card as ACard, Col as ACol, RadioButton as ARadioButton, RadioGroup as ARadioGroup, Row as ARow, Segmented as ASegmented, Space as ASpace, Tag as ATag, message } from 'antdv-next';
import * as echarts from 'echarts';
import { useAppStore } from '~/stores/modules/app';

defineOptions({ name: 'DashboardAnalysis' });
const appStore = useAppStore();

// ========== 主题相关 ==========
const isDark = computed(() => appStore.themeMode === 'dark');

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
  'rounded-lg border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900',
  'shadow-sm transition-all duration-300 hover:shadow-md',
);
const sectionTitleClassName = cn(
  'mb-4 text-base font-semibold text-gray-800 dark:text-gray-200',
);

// ═══════════════════════════════════════════
// 📈 数据分析图表数据
// ═══════════════════════════════════════════

// KPI 统计卡片
interface KpiItem {
  title: string;
  value: string;
  icon: string;
  color: string;
  trend: number;
  /** 对比口径（如「较昨日」）；省略时只显示涨跌百分比 */
  trendLabel?: string;
}

// 原「工作台」的总用户数/活跃会话/告警数量在此并入；
// 两边的「今日访问」是同一个指标，只保留一条，避免同页重复。
const kpiList: KpiItem[] = [
  {
    title: '总用户数',
    value: '1,286',
    icon: 'carbon:user-multiple',
    color: 'blue',
    trend: 12,
  },
  {
    title: '今日访问',
    value: '12,847',
    icon: 'carbon:view',
    color: 'emerald',
    trend: 12.5,
    trendLabel: '较昨日',
  },
  {
    title: '活跃会话',
    value: '186',
    icon: 'carbon:activity',
    color: 'cyan',
    trend: -3.1,
  },
  {
    title: '告警数量',
    value: '3',
    icon: 'carbon:warning-alt',
    color: 'red',
    trend: -25,
  },
  {
    title: 'API 调用',
    value: '89.4K',
    icon: 'carbon:cloud-upload',
    color: 'violet',
    trend: 24.8,
    trendLabel: '较上周',
  },
  {
    title: '系统负载',
    value: '42%',
    icon: 'carbon:chart-line-data',
    color: 'amber',
    trend: -5.1,
    trendLabel: '较昨日',
  },
];

function kpiIconWrap(color: string): string {
  const map: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
    emerald:
      'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
    violet:
      'bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400',
    amber:
      'bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
    cyan: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-400',
  };
  return cn(
    'flex size-11 shrink-0 items-center justify-center rounded-lg',
    map[color] || map.blue,
  );
}

function kpiTrendColor(trend: number): string {
  return trend >= 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400';
}

// ═══════════════════════════════════════════
// 🗂 工作台并入：快捷操作 / 最近动态
// ═══════════════════════════════════════════

// 原工作台的快捷操作是四个 `cursor-pointer` 却不可点的 div —— 光标在撒谎。
// 并进来时全部换成真实路由跳转；「安全审计」从来没有对应页面，
// 用可访问的「系统日志」替代（后端菜单里 name=MonitorLog，hidden 但仍放行）。
interface QuickAction {
  icon: string;
  title: string;
  desc: string;
  path: string;
  color: string;
}

const quickActions: QuickAction[] = [
  {
    icon: 'carbon:user-multiple',
    title: '用户管理',
    desc: '管理系统用户',
    path: '/system/user',
    color: 'text-ant-primary bg-ant-primary/10',
  },
  {
    icon: 'carbon:user-role',
    title: '角色权限',
    desc: '配置角色与权限',
    path: '/system/role',
    color:
      'text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-900/40',
  },
  {
    icon: 'carbon:document-security',
    title: '系统日志',
    desc: '查看操作审计',
    path: '/system/log',
    color:
      'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/40',
  },
  {
    icon: 'carbon:chart-line-data',
    title: '监控大屏',
    desc: '实时数据监控',
    path: '/screen/monitor',
    color:
      'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/40',
  },
];

const recentActivities = [
  {
    action: '管理员修改了角色「超级管理员」的权限',
    time: '10分钟前',
    type: 'permission',
  },
  { action: '用户「张伟」从北京登录系统', time: '25分钟前', type: 'login' },
  { action: '检测到3条新的安全告警', time: '1小时前', type: 'alert' },
  { action: '数据字典「用户状态」已更新', time: '2小时前', type: 'dict' },
  { action: '系统备份任务执行完成', time: '3小时前', type: 'system' },
];

function activityDotColor(type: string): string {
  const map: Record<string, string> = {
    alert: 'bg-red-400',
    login: 'bg-ant-primary',
    permission: 'bg-amber-400',
  };
  return map[type] || 'bg-gray-400 dark:bg-gray-600';
}

const todayLabel = new Date().toLocaleDateString('zh-CN', {
  day: 'numeric',
  month: 'long',
  weekday: 'long',
  year: 'numeric',
});

// ECharts 主题工具函数
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

function baseOption(extra: Record<string, any> = {}): Record<string, any> {
  return {
    backgroundColor: 'transparent',
    tooltip: {
      backgroundColor: tooltipBg(),
      borderColor: borderColor(),
      textStyle: { color: textColor(), fontSize: 13 },
      extraCssText:
        'border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.1);',
    },
    ...extra,
  };
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

// Chart 1: 系统活动趋势（主图）
function initMainTrend() {
  const el = mainTrendRef.value;
  if (!el) return;
  const instance = echarts.init(el, isDark.value ? 'dark' : undefined);
  charts.set('mainTrend', instance);

  const days = Array.from({ length: 30 }, (_, i) => `${i + 1}日`);
  const pv = Array.from({ length: 30 }, () =>
    Math.floor(Math.random() * 5000 + 3000),
  );
  const uv = Array.from({ length: 30 }, () =>
    Math.floor(Math.random() * 2000 + 800),
  );
  const apiCalls = Array.from({ length: 30 }, () =>
    Math.floor(Math.random() * 80_000 + 40_000),
  );

  instance.setOption(
    baseOption({
      legend: {
        data: ['页面访问(PV)', '独立访客(UV)', 'API调用'],
        top: 0,
        right: 0,
        textStyle: { color: subTextColor(), fontSize: 12 },
        itemWidth: 14,
        itemHeight: 3,
        itemGap: 20,
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
        data: days,
        boundaryGap: false,
        axisLine: { lineStyle: { color: axisLineColor() } },
        axisLabel: { color: subTextColor(), fontSize: 11, interval: 4 },
        axisTick: { show: false },
      },
      yAxis: [
        {
          type: 'value',
          name: '访问量',
          nameTextStyle: { color: subTextColor(), fontSize: 11 },
          axisLabel: { color: subTextColor(), fontSize: 11 },
          splitLine: {
            lineStyle: { color: borderColor(), type: 'dashed', opacity: 0.5 },
          },
          position: 'left',
        },
        {
          type: 'value',
          name: 'API',
          nameTextStyle: { color: subTextColor(), fontSize: 11 },
          axisLabel: {
            color: subTextColor(),
            fontSize: 11,
            formatter: (v: number) => `${v / 1000}k`,
          },
          splitLine: { show: false },
          position: 'right',
        },
      ],
      series: [
        {
          name: '页面访问(PV)',
          type: 'line',
          data: pv,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: PALETTE.primary, width: 2.5 },
          areaStyle: {
            color: gradient(['rgba(22,119,255,0.18)', 'rgba(22,119,255,0.01)']),
          },
          emphasis: { focus: 'series' },
        },
        {
          name: '独立访客(UV)',
          type: 'line',
          data: uv,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: PALETTE.success, width: 2 },
          areaStyle: {
            color: gradient(['rgba(82,196,26,0.12)', 'rgba(82,196,26,0.01)']),
          },
          emphasis: { focus: 'series' },
        },
        {
          name: 'API调用',
          type: 'bar',
          yAxisIndex: 1,
          data: apiCalls,
          barWidth: 10,
          barGap: '-100%',
          itemStyle: {
            borderRadius: [3, 3, 0, 0],
            color: gradient(['rgba(114,46,209,0.6)', 'rgba(114,46,209,0.08)']),
          },
          emphasis: { focus: 'series' },
        },
      ],
      animationDuration: 1200,
      animationEasing: 'cubicOut',
    }),
  );
}

// Chart 2: 流量来源分布
function initTrafficDist() {
  const el = trafficDistRef.value;
  if (!el) return;
  const instance = echarts.init(el, isDark.value ? 'dark' : undefined);
  charts.set('trafficDist', instance);

  const data = [
    { value: 3842, name: '直接访问' },
    { value: 2950, name: '搜索引擎' },
    { value: 1860, name: '外部链接' },
    { value: 1240, name: '社交媒体' },
    { value: 860, name: '邮件推广' },
    { value: 520, name: '其他渠道' },
  ];

  instance.setOption(
    baseOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
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
          label: { show: false },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
              color: textColor(),
            },
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
function initSystemHealth() {
  const el = systemHealthRef.value;
  if (!el) return;
  const instance = echarts.init(el, isDark.value ? 'dark' : undefined);
  charts.set('systemHealth', instance);

  instance.setOption(
    baseOption({
      series: [
        {
          type: 'gauge',
          startAngle: 210,
          endAngle: -30,
          radius: '92%',
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
          pointer: { length: '58%', width: 4, itemStyle: { color: 'auto' } },
          axisTick: { length: 6, lineStyle: { color: 'auto', width: 1.5 } },
          splitLine: { length: 12, lineStyle: { color: 'auto', width: 2 } },
          axisLabel: { color: subTextColor(), distance: 18, fontSize: 10 },
          detail: {
            valueAnimation: true,
            formatter: '{value}%',
            color: textColor(),
            fontSize: 26,
            fontWeight: 700,
            offsetCenter: [0, '55%'],
          },
          title: { show: false },
          data: [{ value: 86.2 }],
          animationDuration: 1800,
        },
      ],
    }),
  );
}

// Chart 4: 资源使用雷达图
function initResourceRadar() {
  const el = resourceRadarRef.value;
  if (!el) return;
  const instance = echarts.init(el, isDark.value ? 'dark' : undefined);
  charts.set('resourceRadar', instance);

  const indicators = [
    { name: 'CPU', max: 100 },
    { name: '内存', max: 100 },
    { name: '磁盘', max: 100 },
    { name: '网络', max: 100 },
    { name: '数据库', max: 100 },
    { name: '缓存', max: 100 },
  ];

  instance.setOption(
    baseOption({
      legend: {
        data: ['当前', '峰值'],
        bottom: 0,
        textStyle: { color: subTextColor(), fontSize: 12 },
      },
      radar: {
        indicator: indicators.map((i) => ({ ...i, color: subTextColor() })),
        axisName: { color: subTextColor(), fontSize: 11 },
        splitArea: {
          areaStyle: {
            color: [
              isDark.value ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
              isDark.value ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
            ],
          },
        },
        splitLine: { lineStyle: { color: borderColor(), opacity: 0.4 } },
        axisLine: { lineStyle: { color: borderColor(), opacity: 0.4 } },
      },
      series: [
        {
          name: '当前',
          type: 'radar',
          data: [{ value: [42, 68, 55, 30, 48, 62], name: '当前' }],
          symbol: 'circle',
          symbolSize: 5,
          lineStyle: { color: PALETTE.primary, width: 2 },
          areaStyle: { color: 'rgba(22,119,255,0.18)' },
          itemStyle: { color: PALETTE.primary },
        },
        {
          name: '峰值',
          type: 'radar',
          data: [{ value: [78, 85, 72, 58, 76, 88], name: '峰值' }],
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: { color: PALETTE.danger, width: 1.5, type: 'dashed' },
          areaStyle: { color: 'rgba(255,77,79,0.06)' },
          itemStyle: { color: PALETTE.danger },
        },
      ],
    }),
  );
}

// Chart 5: API 错误率趋势
function initActivityHeatmap() {
  const el = activityHeatmapRef.value;
  if (!el) return;
  const instance = echarts.init(el, isDark.value ? 'dark' : undefined);
  charts.set('activityHeatmap', instance);

  const hours = Array.from(
    { length: 24 },
    (_, i) => `${String(i).padStart(2, '0')}:00`,
  );
  const errorRates = hours.map((_, i) => {
    const baseError =
      i >= 9 && i <= 18 ? 0.8 + Math.random() * 1.5 : 0.1 + Math.random() * 0.4;
    const spike = Math.random() > 0.9 ? 3 + Math.random() * 2 : 0;
    return Number((baseError + spike).toFixed(2));
  });
  const errors4xx = hours.map(() => Number((Math.random() * 0.8).toFixed(2)));
  const errors5xx = hours.map((v, i) => {
    const val = errorRates[i]! - errors4xx[i]!;
    return Number(Math.max(0, val).toFixed(2));
  });

  instance.setOption(
    baseOption({
      legend: {
        data: ['总错误率', '4xx 客户端错误', '5xx 服务端错误'],
        top: 0,
        textStyle: { color: subTextColor(), fontSize: 10 },
      },
      grid: {
        left: '3%',
        right: '4%',
        top: '32px',
        bottom: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: hours,
        axisLabel: { color: subTextColor(), fontSize: 9, interval: 2 },
        axisLine: { lineStyle: { color: borderColor() } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        name: '错误率 (%)',
        nameTextStyle: { color: subTextColor(), fontSize: 10 },
        axisLabel: {
          color: subTextColor(),
          fontSize: 9,
          formatter: '{value}%',
        },
        splitLine: {
          lineStyle: { color: borderColor(), type: 'dashed', opacity: 0.4 },
        },
      },
      series: [
        {
          name: '总错误率',
          type: 'line',
          data: errorRates,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: PALETTE.danger, width: 2 },
          areaStyle: {
            color: gradient(['rgba(255,77,79,0.15)', 'rgba(255,77,79,0.01)']),
          },
        },
        {
          name: '4xx 客户端错误',
          type: 'bar',
          data: errors4xx,
          barWidth: 6,
          itemStyle: { color: PALETTE.warning, borderRadius: [2, 2, 0, 0] },
        },
        {
          name: '5xx 服务端错误',
          type: 'bar',
          data: errors5xx,
          barWidth: 6,
          itemStyle: { color: PALETTE.danger, borderRadius: [2, 2, 0, 0] },
        },
      ],
      animationDuration: 1200,
    }),
  );
}

// Chart 6: 用户行为漏斗
function initUserJourney() {
  const el = userJourneyRef.value;
  if (!el) return;
  const instance = echarts.init(el, isDark.value ? 'dark' : undefined);
  charts.set('userJourney', instance);

  const stages = [
    { value: 10_000, name: '页面浏览' },
    { value: 7200, name: '功能交互' },
    { value: 4800, name: '数据查询' },
    { value: 2600, name: '业务操作' },
    { value: 1400, name: '任务完成' },
  ];
  const total = stages[0]?.value ?? 10_000;

  instance.setOption(
    baseOption({
      tooltip: {
        formatter: (params: any) => {
          const rate = (((params.value ?? 0) / total) * 100).toFixed(1);
          return `<b>${params.name}</b><br/>人数: ${params.value}<br/>转化率: ${rate}%`;
        },
      },
      series: [
        {
          type: 'funnel',
          left: '12%',
          top: 16,
          bottom: 16,
          width: '76%',
          sort: 'descending',
          gap: 3,
          label: {
            show: true,
            position: 'inside',
            formatter: '{b}\n{c}',
            color: '#fff',
            fontSize: 12,
            fontWeight: 500,
          },
          labelLine: { show: false },
          itemStyle: {
            borderColor: isDark.value ? '#111827' : '#fff',
            borderWidth: 2,
            shadowBlur: 8,
            shadowColor: 'rgba(0,0,0,0.08)',
          },
          data: stages,
          color: [PALETTE.primary, '#4096ff', '#69b1ff', '#91caff', '#bae0fe'],
          animationDuration: 1500,
        },
      ],
    }),
  );
}

// Chart 7: 模块使用排行（动态）
let moduleRankTimer: null | ReturnType<typeof setInterval> = null;

function initModuleRank() {
  const el = moduleRankRef.value;
  if (!el) return;
  const instance = echarts.init(el, isDark.value ? 'dark' : undefined);
  charts.set('moduleRank', instance);

  const modules = [
    '用户管理',
    '角色权限',
    '菜单配置',
    '字典数据',
    '系统设置',
    '操作日志',
    '在线用户',
    '定时任务',
  ];
  let round = 0;

  function update() {
    const baseData = [
      [420, 380, 350, 320, 290, 250, 220, 190],
      [450, 410, 330, 340, 310, 270, 240, 210],
      [480, 430, 310, 360, 330, 290, 260, 230],
      [510, 460, 340, 380, 350, 310, 280, 250],
      [530, 480, 360, 400, 370, 330, 300, 270],
    ];
    const current = baseData[round % baseData.length]!;
    const sorted = modules
      .map((name, i) => ({
        name,
        value: current[i]! + Math.round(Math.random() * 30 - 15),
      }))
      .sort((a, b) => b.value - a.value);

    instance.setOption({
      grid: {
        left: '2%',
        right: '8%',
        top: '2%',
        bottom: '2%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        max: 600,
        axisLabel: { color: subTextColor(), fontSize: 10 },
        splitLine: {
          lineStyle: { color: borderColor(), type: 'dashed', opacity: 0.4 },
        },
      },
      yAxis: {
        type: 'category',
        data: sorted.map((d) => d.name),
        axisLabel: { color: textColor(), fontSize: 12 },
        axisTick: { show: false },
        axisLine: { show: false },
        inverse: true,
      },
      series: [
        {
          type: 'bar',
          data: sorted.map((d) => ({
            value: d.value,
            itemStyle: {
              color: gradient(
                [PALETTE.primary, 'rgba(22,119,255,0.25)'],
                false,
              ),
              borderRadius: [0, 4, 4, 0],
            },
          })),
          barWidth: 16,
          label: {
            show: true,
            position: 'right',
            color: subTextColor(),
            fontSize: 11,
            formatter: '{c}',
          },
          animationDuration: 800,
          animationEasing: 'cubicInOut',
        },
      ],
    });
    round++;
  }

  instance.setOption(baseOption({}));
  update();
  moduleRankTimer = setInterval(update, 3500);
}

// 导出报告
const CHART_EXPORT_CONFIG: { name: string; key: string }[] = [
  { name: '系统活动趋势', key: 'mainTrend' },
  { name: '流量来源分布', key: 'trafficDist' },
  { name: '系统健康度', key: 'systemHealth' },
  { name: '资源使用概况', key: 'resourceRadar' },
  { name: '用户活跃时段', key: 'activityHeatmap' },
  { name: '用户行为漏斗', key: 'userJourney' },
  { name: '模块使用热度', key: 'moduleRank' },
];

function handleExportReport() {
  if (charts.size === 0) {
    message.warning('图表尚未加载完成，请稍后再试');
    return;
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
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

  ctx.fillStyle = isDark.value ? '#111827' : '#ffffff';
  ctx.fillRect(0, 0, canvas.width / 2, totalHeight);

  ctx.fillStyle = isDark.value ? '#f9fafb' : '#111827';
  ctx.font = 'bold 28px -apple-system, "SF Pro Text", sans-serif';
  ctx.fillText('数据可视化报告', padding, padding + 32);
  ctx.fillStyle = isDark.value ? '#9ca3af' : '#6b7280';
  ctx.font = '14px -apple-system, "SF Pro Text", sans-serif';
  ctx.fillText(
    `生成时间：${new Date().toLocaleString('zh-CN')}`,
    padding,
    padding + 58,
  );
  ctx.fillStyle = isDark.value ? '#374151' : '#e5e7eb';
  ctx.fillRect(padding, padding + 70, canvas.width / 2 - padding * 2, 1);

  let offsetY = padding + headerHeight + padding;

  for (const item of CHART_EXPORT_CONFIG) {
    ctx.fillStyle = isDark.value ? '#d1d5db' : '#374151';
    ctx.font = 'bold 16px -apple-system, "SF Pro Text", sans-serif';
    ctx.fillText(item.name, padding, offsetY + 24);
    offsetY += labelHeight;

    const instance = charts.get(item.key);
    if (instance) {
      try {
        const dataUrl = instance.getDataURL({
          type: 'png',
          pixelRatio: 2,
          backgroundColor: isDark.value ? '#1f2937' : '#ffffff',
        });
        const img = new Image();
        img.onload = () => {
          const ratio = (canvas.width / 2 - padding * 2) / img.width;
          const drawH = img.height * ratio;
          ctx.drawImage(
            img,
            padding,
            offsetY,
            canvas.width / 2 - padding * 2,
            drawH,
          );
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
      ctx.fillStyle = isDark.value ? '#374151' : '#e5e7eb';
      ctx.fillRect(
        padding,
        offsetY - chartGap / 2,
        canvas.width / 2 - padding * 2,
        1,
      );
    }
  }

  let doneCount = 0;
  function checkLast() {
    doneCount++;
    if (doneCount >= CHART_EXPORT_CONFIG.length) triggerDownload();
  }

  function triggerDownload() {
    const link = document.createElement('a');
    link.download = `数据可视化报告_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png', 1);
    link.click();
    message.success('报告导出成功！');
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
  safeInit('mainTrend', mainTrendRef, () => initMainTrend());
  safeInit('trafficDist', trafficDistRef, () => initTrafficDist());
  safeInit('systemHealth', systemHealthRef, () => initSystemHealth());
  safeInit('resourceRadar', resourceRadarRef, () => initResourceRadar());
  safeInit('activityHeatmap', activityHeatmapRef, () => initActivityHeatmap());
  safeInit('userJourney', userJourneyRef, () => initUserJourney());
  safeInit('moduleRank', moduleRankRef, () => initModuleRank());
}

function disposeAll() {
  charts.forEach((c) => c.dispose());
  charts.clear();
}

useEventListener(window, 'resize', () => charts.forEach((c) => c.resize()));

onMounted(() => {
  nextTick(() => initAllCharts());
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
    <div class="mb-2 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-800 dark:text-white">
          分析面板
        </h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          系统数据分析与可视化 · {{ todayLabel }}
        </p>
      </div>
      <ASpace>
        <ASegmented
          :options="['今日', '近7天', '近30天']"
          default-value="今日"
          size="small"
        />
        <AButton size="small" @click="handleExportReport">
          <template #icon>
            <Icon icon="carbon:download" />
          </template>
          导出报告
        </AButton>
      </ASpace>
    </div>

    <!-- 数据分析内容 -->
    <div class="space-y-8">
      <!-- KPI 统计卡片区：6 张卡按 1/2/3 列铺开，正好整除，不留半空行 -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div v-for="kpi in kpiList" :key="kpi.title">
          <div
            :class="
              cn(
                'h-full rounded-lg border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900',
                'transition-all duration-300 hover:shadow-md',
              )
            "
          >
            <div class="flex items-start gap-4">
              <div :class="kpiIconWrap(kpi.color)">
                <Icon :icon="kpi.icon" :width="22" :height="22" />
              </div>
              <div class="min-w-0 flex-1">
                <p
                  class="text-2xl leading-tight font-bold tracking-tight text-gray-800 dark:text-white"
                >
                  {{ kpi.value }}
                </p>
                <p class="mt-1 text-sm text-gray-400 dark:text-gray-500">
                  {{ kpi.title }}
                </p>
                <div class="mt-1.5 flex items-center gap-1">
                  <Icon
                    :icon="
                      kpi.trend >= 0 ? 'carbon:arrow-up' : 'carbon:arrow-down'
                    "
                    :width="12"
                    :height="12"
                    :class="
                      kpi.trend >= 0 ? 'text-emerald-500' : 'text-red-500'
                    "
                  />
                  <span
                    :class="
                      cn('text-xs font-semibold', kpiTrendColor(kpi.trend))
                    "
                  >
                    {{ Math.abs(kpi.trend) }}%
                  </span>
                  <span v-if="kpi.trendLabel" class="text-xs text-gray-400">{{
                    kpi.trendLabel
                  }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 主趋势图：全宽 -->
      <ACard
        :class="analyticsCardClassName"
        variant="borderless"
        :styles="{ body: { padding: '20px 24px' } }"
        class="mt-6"
      >
        <div class="mb-4 flex items-center justify-between">
          <h3 :class="sectionTitleClassName">系统活动趋势</h3>
          <ARadioGroup
            size="small"
            button-style="solid"
            default-value="pv"
            class="origin-right scale-90"
          >
            <ARadioButton value="pv"> PV / UV </ARadioButton>
            <ARadioButton value="api"> API 调用 </ARadioButton>
          </ARadioGroup>
        </div>
        <div ref="mainTrendRef" class="w-full" style="height: 380px"></div>
      </ACard>

      <!-- 第二行：分布 + 仪表盘 -->
      <ARow :gutter="[16, 16]" class="mt-6">
        <ACol :xs="24" :lg="12">
          <ACard
            :class="analyticsCardClassName"
            variant="borderless"
            :styles="{ body: { padding: '20px 24px' } }"
          >
            <h3 :class="sectionTitleClassName">流量来源分布</h3>
            <div
              ref="trafficDistRef"
              class="w-full"
              style="height: 320px"
            ></div>
          </ACard>
        </ACol>
        <ACol :xs="24" :lg="12">
          <ACard
            :class="analyticsCardClassName"
            variant="borderless"
            :styles="{ body: { padding: '20px 24px' } }"
          >
            <h3 :class="sectionTitleClassName">系统健康度</h3>
            <div
              ref="systemHealthRef"
              class="w-full"
              style="height: 320px"
            ></div>
          </ACard>
        </ACol>
      </ARow>

      <!-- 第三行：雷达图 + 热力图 -->
      <ARow :gutter="[16, 16]">
        <ACol :xs="24" :lg="12">
          <ACard
            :class="analyticsCardClassName"
            variant="borderless"
            :styles="{ body: { padding: '20px 24px' } }"
          >
            <h3 :class="sectionTitleClassName">资源使用概况</h3>
            <div
              ref="resourceRadarRef"
              class="w-full"
              style="height: 320px"
            ></div>
          </ACard>
        </ACol>
        <ACol :xs="24" :lg="12">
          <ACard
            :class="analyticsCardClassName"
            variant="borderless"
            :styles="{ body: { padding: '20px 24px' } }"
          >
            <h3 :class="sectionTitleClassName">API 错误率趋势</h3>
            <div
              ref="activityHeatmapRef"
              class="w-full"
              style="height: 320px"
            ></div>
          </ACard>
        </ACol>
      </ARow>

      <!-- 第四行：漏斗 + 排行榜 -->
      <ARow :gutter="[16, 16]" class="items-stretch">
        <ACol :xs="24" :lg="10" class="mb-2">
          <ACard
            :class="cn(analyticsCardClassName, 'h-full')"
            variant="borderless"
            :styles="{
              body: {
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
              },
            }"
          >
            <h3 :class="sectionTitleClassName">用户行为漏斗</h3>
            <div
              ref="userJourneyRef"
              class="w-full flex-1"
              style="min-height: 280px"
            ></div>
          </ACard>
        </ACol>
        <ACol :xs="24" :lg="14" class="mb-2">
          <ACard
            :class="cn(analyticsCardClassName, 'h-full')"
            variant="borderless"
            :styles="{
              body: {
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
              },
            }"
          >
            <div class="mb-4 flex items-center justify-between">
              <h3 :class="sectionTitleClassName">模块使用热度</h3>
              <ATag color="blue" class="text-[11px]"> 实时更新 </ATag>
            </div>
            <div
              ref="moduleRankRef"
              class="w-full flex-1"
              style="min-height: 280px"
            ></div>
          </ACard>
        </ACol>
      </ARow>

      <!-- 第五行：快捷操作 + 最近动态（原工作台内容并入） -->
      <ARow :gutter="[16, 16]" class="items-stretch">
        <ACol :xs="24" :lg="12">
          <ACard
            :class="analyticsCardClassName"
            variant="borderless"
            :styles="{ body: { padding: '20px 24px' } }"
          >
            <h3 :class="sectionTitleClassName">快捷操作</h3>
            <div class="grid grid-cols-2 gap-3">
              <RouterLink
                v-for="action in quickActions"
                :key="action.title"
                :to="action.path"
                class="group flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <span
                  :class="
                    cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                      action.color,
                    )
                  "
                >
                  <Icon :icon="action.icon" :width="18" :height="18" />
                </span>
                <span class="min-w-0">
                  <span
                    class="block text-sm font-medium text-gray-700 transition-colors group-hover:text-ant-primary dark:text-gray-300"
                    >{{ action.title }}</span>
                  <span class="mt-0.5 block text-[11px] text-gray-400">{{
                    action.desc
                  }}</span>
                </span>
              </RouterLink>
            </div>
          </ACard>
        </ACol>
        <ACol :xs="24" :lg="12">
          <ACard
            :class="analyticsCardClassName"
            variant="borderless"
            :styles="{ body: { padding: '20px 24px' } }"
          >
            <h3 :class="sectionTitleClassName">最近动态</h3>
            <ul class="space-y-3">
              <li
                v-for="(activity, i) in recentActivities"
                :key="i"
                class="flex items-start gap-3 text-sm"
              >
                <span
                  :class="
                    cn(
                      'mt-2 h-1.5 w-1.5 shrink-0 rounded-full',
                      activityDotColor(activity.type),
                    )
                  "
                ></span>
                <span class="min-w-0 flex-1">
                  <span
                    class="block truncate text-gray-600 dark:text-gray-400"
                    >{{ activity.action }}</span>
                  <span class="mt-0.5 block text-[11px] text-gray-400">{{
                    activity.time
                  }}</span>
                </span>
              </li>
            </ul>
          </ACard>
        </ACol>
      </ARow>
    </div>
  </div>
</template>
<route lang="json">
{
  "name": "Analysis",
  "meta": {
    "title": "分析面板"
  }
}
</route>
