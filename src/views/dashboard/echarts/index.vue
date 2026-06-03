<script setup lang="ts">
import type { Ref } from 'vue'
import { Icon } from '@iconify/vue'
import { useEventListener } from '@vueuse/core'
import { message } from 'antdv-next'
import * as echarts from 'echarts'
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useAppStore } from '@/stores/modules/app'
import { cn } from '@/utils/cn'

const appStore = useAppStore()
const isDark = computed(() => appStore.themeMode === 'dark')

// ========== 图表实例管理 ==========
const charts = new Map<string, echarts.ECharts>()

const mainTrendRef = ref<HTMLDivElement>()
const trafficDistRef = ref<HTMLDivElement>()
const systemHealthRef = ref<HTMLDivElement>()
const resourceRadarRef = ref<HTMLDivElement>()
const activityHeatmapRef = ref<HTMLDivElement>()
const userJourneyRef = ref<HTMLDivElement>()
const moduleRankRef = ref<HTMLDivElement>()

// ========== 样式类名 ==========
const containerClassName = cn('space-y-8 min-h-screen')
const cardClassName = cn(
  'rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900',
  'transition-all duration-300 hover:shadow-md',
)
const sectionTitleClassName = cn(
  'text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4',
)

// ========== KPI 统计卡片 ==========
interface KpiItem {
  title: string
  value: string
  icon: string
  color: string
  trend: number
  trendLabel: string
}

const kpiList: KpiItem[] = [
  { title: '今日访问', value: '12,847', icon: 'carbon:view', color: 'blue', trend: 12.5, trendLabel: '较昨日' },
  { title: '活跃用户', value: '1,286', icon: 'carbon:user-multiple', color: 'emerald', trend: -3.2, trendLabel: '较昨日' },
  { title: 'API 调用', value: '89.4K', icon: 'carbon:cloud-upload', color: 'violet', trend: 24.8, trendLabel: '较上周' },
  { title: '系统负载', value: '42%', icon: 'carbon:chart-line-data', color: 'amber', trend: -5.1, trendLabel: '较昨日' },
]

function kpiCardBg(color: string): string {
  const map: Record<string, string> = {
    blue: 'bg-blue-50/80 dark:bg-blue-950/20',
    emerald: 'bg-emerald-50/80 dark:bg-emerald-950/20',
    violet: 'bg-violet-50/80 dark:bg-violet-950/20',
    amber: 'bg-amber-50/80 dark:bg-amber-950/20',
  }
  return map[color] || map.blue
}

function kpiIconWrap(color: string): string {
  const map: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
    emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
    violet: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400',
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  }
  return cn('w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0', map[color] || map.blue)
}

// ========== ECharts 主题工具函数 ==========
function textColor() { return isDark.value ? '#d1d5db' : '#374151' }
function subTextColor() { return isDark.value ? '#6b7280' : '#9ca3af' }
function borderColor() { return isDark.value ? '#374151' : '#e5e7eb' }
function axisLineColor() { return isDark.value ? '#4b5563' : '#d1d5db' }
function tooltipBg() { return isDark.value ? 'rgba(31,41,55,0.96)' : 'rgba(255,255,255,0.96)' }

function baseOption(extra: Record<string, any> = {}): Record<string, any> {
  return {
    backgroundColor: 'transparent',
    tooltip: {
      backgroundColor: tooltipBg(),
      borderColor: borderColor(),
      textStyle: { color: textColor(), fontSize: 13 },
      extraCssText: 'border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.1);',
    },
    ...extra,
  }
}

function gradient(colors: [string, string], vertical = true) {
  return new echarts.graphic.LinearGradient(0, 0, vertical ? 0 : 1, vertical ? 1 : 0, [{ offset: 0, color: colors[0] }, { offset: 1, color: colors[1] }])
}

const PALETTE = {
  primary: '#1677ff',
  success: '#52c41a',
  warning: '#faad14',
  danger: '#ff4d4f',
  info: '#722ed1',
  cyan: '#13c2c2',
}

// ========== Chart 1: 系统活动趋势（主图） ==========
function initMainTrend() {
  const el = mainTrendRef.value
  if (!el)
    return
  const instance = echarts.init(el, isDark.value ? 'dark' : undefined)
  charts.set('mainTrend', instance)

  const days = Array.from({ length: 30 }, (_, i) => `${i + 1}日`)
  const pv = Array.from({ length: 30 }, () => Math.floor(Math.random() * 5000 + 3000))
  const uv = Array.from({ length: 30 }, () => Math.floor(Math.random() * 2000 + 800))
  const apiCalls = Array.from({ length: 30 }, () => Math.floor(Math.random() * 80000 + 40000))

  instance.setOption(baseOption({
    legend: {
      data: ['页面访问(PV)', '独立访客(UV)', 'API调用'],
      top: 0,
      right: 0,
      textStyle: { color: subTextColor(), fontSize: 12 },
      itemWidth: 14,
      itemHeight: 3,
      itemGap: 20,
    },
    grid: { left: '3%', right: '4%', top: '36px', bottom: '8%', containLabel: true },
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
        splitLine: { lineStyle: { color: borderColor(), type: 'dashed', opacity: 0.5 } },
        position: 'left',
      },
      {
        type: 'value',
        name: 'API',
        nameTextStyle: { color: subTextColor(), fontSize: 11 },
        axisLabel: { color: subTextColor(), fontSize: 11, formatter: (v: number) => `${v / 1000}k` },
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
        areaStyle: { color: gradient(['rgba(22,119,255,0.18)', 'rgba(22,119,255,0.01)']) },
        emphasis: { focus: 'series' },
      },
      {
        name: '独立访客(UV)',
        type: 'line',
        data: uv,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: PALETTE.success, width: 2 },
        areaStyle: { color: gradient(['rgba(82,196,26,0.12)', 'rgba(82,196,26,0.01)']) },
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
  }))
}

// ========== Chart 2: 流量来源分布 ==========
function initTrafficDist() {
  const el = trafficDistRef.value
  if (!el)
    return
  const instance = echarts.init(el, isDark.value ? 'dark' : undefined)
  charts.set('trafficDist', instance)

  const data = [
    { value: 3842, name: '直接访问' },
    { value: 2950, name: '搜索引擎' },
    { value: 1860, name: '外部链接' },
    { value: 1240, name: '社交媒体' },
    { value: 860, name: '邮件推广' },
    { value: 520, name: '其他渠道' },
  ]

  instance.setOption(baseOption({
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
    series: [{
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
        label: { show: true, fontSize: 14, fontWeight: 'bold', color: textColor() },
        scaleSize: 8,
      },
      data,
      color: [PALETTE.primary, PALETTE.success, PALETTE.warning, PALETTE.info, PALETTE.cyan, PALETTE.danger],
    }],
  }))
}

// ========== Chart 3: 系统健康仪表盘 ==========
function initSystemHealth() {
  const el = systemHealthRef.value
  if (!el)
    return
  const instance = echarts.init(el, isDark.value ? 'dark' : undefined)
  charts.set('systemHealth', instance)

  instance.setOption(baseOption({
    series: [{
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
    }],
  }))
}

// ========== Chart 4: 资源使用雷达图 ==========
function initResourceRadar() {
  const el = resourceRadarRef.value
  if (!el)
    return
  const instance = echarts.init(el, isDark.value ? 'dark' : undefined)
  charts.set('resourceRadar', instance)

  const indicators = [
    { name: 'CPU', max: 100 },
    { name: '内存', max: 100 },
    { name: '磁盘', max: 100 },
    { name: '网络', max: 100 },
    { name: '数据库', max: 100 },
    { name: '缓存', max: 100 },
  ]

  instance.setOption(baseOption({
    legend: {
      data: ['当前', '峰值'],
      bottom: 0,
      textStyle: { color: subTextColor(), fontSize: 12 },
    },
    radar: {
      indicator: indicators.map(i => ({ ...i, color: subTextColor() })),
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
  }))
}

// ========== Chart 5: 活动热力图 ==========
function initActivityHeatmap() {
  const el = activityHeatmapRef.value
  if (!el)
    return
  const instance = echarts.init(el, isDark.value ? 'dark' : undefined)
  charts.set('activityHeatmap', instance)

  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const hours = Array.from({ length: 12 }, (_, i) => `${String(i + 8).padStart(2, '0')}:00`)
  const data: number[][] = []
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 12; h++) {
      const base = d < 5 ? 80 + Math.sin(h * 0.6) * 50 : 30 + Math.random() * 40
      data.push([h, d, Math.floor(base + Math.random() * 50)])
    }
  }

  instance.setOption(baseOption({
    grid: { left: '8%', right: '8%', top: '4%', bottom: '12%' },
    xAxis: {
      type: 'category',
      data: hours,
      axisLabel: { color: subTextColor(), fontSize: 10 },
      splitArea: { show: true },
    },
    yAxis: {
      type: 'category',
      data: days,
      axisLabel: { color: subTextColor(), fontSize: 11 },
      splitArea: { show: true },
    },
    visualMap: {
      min: 0,
      max: 160,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: -4,
      inRange: { color: ['#f0f9ff', '#bae0fe', '#59a5f0', '#1677ff', '#0958d9'] },
      textStyle: { color: subTextColor(), fontSize: 10 },
      itemWidth: 10,
      itemHeight: 8,
    },
    series: [{
      type: 'heatmap',
      data,
      label: { show: false },
      emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.15)' } },
    }],
  }))
}

// ========== Chart 6: 用户行为漏斗 ==========
function initUserJourney() {
  const el = userJourneyRef.value
  if (!el)
    return
  const instance = echarts.init(el, isDark.value ? 'dark' : undefined)
  charts.set('userJourney', instance)

  const stages = [
    { value: 10000, name: '页面浏览' },
    { value: 7200, name: '功能交互' },
    { value: 4800, name: '数据查询' },
    { value: 2600, name: '业务操作' },
    { value: 1400, name: '任务完成' },
  ]
  const total = stages[0]?.value ?? 10000

  instance.setOption(baseOption({
    tooltip: {
      formatter: (params: any) => {
        const rate = (((params.value ?? 0) / total) * 100).toFixed(1)
        return `<b>${params.name}</b><br/>人数: ${params.value}<br/>转化率: ${rate}%`
      },
    },
    series: [{
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
    }],
  }))
}

// ========== Chart 7: 模块使用排行（动态） ==========
function initModuleRank() {
  const el = moduleRankRef.value
  if (!el)
    return
  const instance = echarts.init(el, isDark.value ? 'dark' : undefined)
  charts.set('moduleRank', instance)

  const modules = ['用户管理', '角色权限', '菜单配置', '字典数据', '系统设置', '操作日志', '在线用户', '定时任务']
  let round = 0
  let timer: ReturnType<typeof setInterval> | null = null

  function update() {
    const baseData = [
      [420, 380, 350, 320, 290, 250, 220, 190],
      [450, 410, 330, 340, 310, 270, 240, 210],
      [480, 430, 310, 360, 330, 290, 260, 230],
      [510, 460, 340, 380, 350, 310, 280, 250],
      [530, 480, 360, 400, 370, 330, 300, 270],
    ]
    const current = baseData[round % baseData.length]!
    const sorted = modules.map((name, i) => ({ name, value: current[i]! + Math.round(Math.random() * 30 - 15) }))
      .sort((a, b) => b.value - a.value)

    instance.setOption({
      grid: { left: '2%', right: '8%', top: '2%', bottom: '2%', containLabel: true },
      xAxis: {
        type: 'value',
        max: 600,
        axisLabel: { color: subTextColor(), fontSize: 10 },
        splitLine: { lineStyle: { color: borderColor(), type: 'dashed', opacity: 0.4 } },
      },
      yAxis: {
        type: 'category',
        data: sorted.map(d => d.name),
        axisLabel: { color: textColor(), fontSize: 12 },
        axisTick: { show: false },
        axisLine: { show: false },
        inverse: true,
      },
      series: [{
        type: 'bar',
        data: sorted.map((d, i) => ({
          value: d.value,
          itemStyle: {
            color: gradient([PALETTE.primary, 'rgba(22,119,255,0.25)'], false),
            borderRadius: [0, 4, 4, 0],
          },
        })),
        barWidth: 16,
        label: { show: true, position: 'right', color: subTextColor(), fontSize: 11, formatter: '{c}' },
        animationDuration: 800,
        animationEasing: 'cubicInOut',
      }],
    })
    round++
  }

  instance.setOption(baseOption({}))
  update()
  timer = setInterval(update, 3500)

  onBeforeUnmount(() => {
    if (timer)
      clearInterval(timer)
  })
}

// ========== 导出报告 ==========
const CHART_EXPORT_CONFIG: { name: string, key: string }[] = [
  { name: '系统活动趋势', key: 'mainTrend' },
  { name: '流量来源分布', key: 'trafficDist' },
  { name: '系统健康度', key: 'systemHealth' },
  { name: '资源使用概况', key: 'resourceRadar' },
  { name: '用户活跃时段', key: 'activityHeatmap' },
  { name: '用户行为漏斗', key: 'userJourney' },
  { name: '模块使用热度', key: 'moduleRank' },
]

function handleExportReport() {
  if (charts.size === 0) {
    message.warning('图表尚未加载完成，请稍后再试')
    return
  }

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const padding = 40
  const chartGap = 30
  const labelHeight = 36
  const headerHeight = 100

  // 计算总高度
  let totalHeight = padding + headerHeight + padding
  for (const item of CHART_EXPORT_CONFIG) {
    totalHeight += labelHeight + chartGap
    const instance = charts.get(item.key)
    if (instance) {
      const el = instance.getDom()
      totalHeight += Math.max(Number(el.offsetHeight) || 400, 400)
    }
    else {
      totalHeight += 400
    }
  }
  totalHeight += padding

  canvas.width = 1400
  canvas.height = totalHeight * 2 // 2x 高清
  ctx.scale(2, 2)

  // 背景
  ctx.fillStyle = isDark.value ? '#111827' : '#ffffff'
  ctx.fillRect(0, 0, canvas.width / 2, totalHeight)

  // 标题区域
  ctx.fillStyle = isDark.value ? '#f9fafb' : '#111827'
  ctx.font = 'bold 28px -apple-system, "SF Pro Text", sans-serif'
  ctx.fillText('数据可视化报告', padding, padding + 32)
  ctx.fillStyle = isDark.value ? '#9ca3af' : '#6b7280'
  ctx.font = '14px -apple-system, "SF Pro Text", sans-serif'
  ctx.fillText(`生成时间：${new Date().toLocaleString('zh-CN')}`, padding, padding + 58)
  ctx.fillStyle = isDark.value ? '#374151' : '#e5e7eb'
  ctx.fillRect(padding, padding + 70, canvas.width / 2 - padding * 2, 1)

  let offsetY = padding + headerHeight + padding

  for (const item of CHART_EXPORT_CONFIG) {
    // 图表标题
    ctx.fillStyle = isDark.value ? '#d1d5db' : '#374151'
    ctx.font = 'bold 16px -apple-system, "SF Pro Text", sans-serif'
    ctx.fillText(item.name, padding, offsetY + 24)
    offsetY += labelHeight

    const instance = charts.get(item.key)
    if (instance) {
      try {
        const dataUrl = instance.getDataURL({
          type: 'png',
          pixelRatio: 2,
          backgroundColor: isDark.value ? '#1f2937' : '#ffffff',
        })
        const img = new Image()
        img.onload = () => {
          const ratio = (canvas.width / 2 - padding * 2) / img.width
          const drawH = img.height * ratio
          ctx.drawImage(img, padding, offsetY, canvas.width / 2 - padding * 2, drawH)
          offsetY += drawH + chartGap
          // 最后一个图表时触发下载
          if (item === CHART_EXPORT_CONFIG[CHART_EXPORT_CONFIG.length - 1]) {
            triggerDownload()
          }
        }
        img.onerror = () => { offsetY += 300 + chartGap; checkLast() }
        img.src = dataUrl
      }
      catch {
        offsetY += 300 + chartGap
        checkLast()
      }
    }
    else {
      offsetY += 300 + chartGap
      checkLast()
    }

    // 分隔线（非最后一个）
    if (item !== CHART_EXPORT_CONFIG[CHART_EXPORT_CONFIG.length - 1]) {
      ctx.fillStyle = isDark.value ? '#374151' : '#e5e7eb'
      ctx.fillRect(padding, offsetY - chartGap / 2, canvas.width / 2 - padding * 2, 1)
    }
  }

  let doneCount = 0
  function checkLast() {
    doneCount++
    if (doneCount >= CHART_EXPORT_CONFIG.length)
      triggerDownload()
  }

  function triggerDownload() {
    const link = document.createElement('a')
    link.download = `数据可视化报告_${new Date().toISOString().slice(0, 10)}.png`
    link.href = canvas.toDataURL('image/png', 1.0)
    link.click()
    message.success('报告导出成功！')
  }
}

// ========== 生命周期 ==========

/** 安全初始化图表：等容器有实际尺寸后再 echarts.init */
function safeInit(name: string, refEl: Ref<HTMLDivElement | undefined>, initFn: (el: HTMLDivElement) => void) {
  const el = refEl.value
  if (!el || charts.has(name))
    return

  // 容器已有尺寸，直接初始化
  if (el.offsetWidth > 0 && el.offsetHeight > 0) {
    initFn(el)
    return
  }

  // 否则用 ResizeObserver 监听尺寸变化
  let cleaned = false
  const observer = new ResizeObserver((entries) => {
    if (cleaned)
      return
    for (const entry of entries) {
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        cleaned = true
        observer.disconnect()
        const target = refEl.value
        if (target && !charts.has(name)) {
          initFn(target)
        }
        break
      }
    }
  })
  observer.observe(el)

  // 超时兜底：3 秒后强制初始化
  setTimeout(() => {
    if (!cleaned && !charts.has(name)) {
      cleaned = true
      observer.disconnect()
      const target = refEl.value
      if (target)
        initFn(target)
    }
  }, 3000)
}

function initAll() {
  safeInit('mainTrend', mainTrendRef, el => initMainTrend())
  safeInit('trafficDist', trafficDistRef, el => initTrafficDist())
  safeInit('systemHealth', systemHealthRef, el => initSystemHealth())
  safeInit('resourceRadar', resourceRadarRef, el => initResourceRadar())
  safeInit('activityHeatmap', activityHeatmapRef, el => initActivityHeatmap())
  safeInit('userJourney', userJourneyRef, el => initUserJourney())
  safeInit('moduleRank', moduleRankRef, el => initModuleRank())
}

function disposeAll() {
  charts.forEach(c => c.dispose())
  charts.clear()
}

useEventListener(window, 'resize', () => charts.forEach(c => c.resize()))

onMounted(() => {
  nextTick(() => initAll())
})
onBeforeUnmount(disposeAll)
</script>

<template>
  <div :class="containerClassName">
    <!-- 页面标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-800 dark:text-white">
          数据可视化
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          系统运行状态与数据分析面板
        </p>
      </div>
      <a-space>
        <a-segmented
          :options="['今日',
                     '近7天',
                     '近30天']"
          default-value="今日"
          size="small"
        />
        <a-button
          size="small"
          @click="handleExportReport"
        >
          <template #icon>
            <Icon icon="carbon:download" />
          </template>
          导出报告
        </a-button>
      </a-space>
    </div>

    <!-- KPI 统计卡片区 -->
    <a-row
      :gutter="[16,
                16]"
    >
      <a-col
        v-for="kpi in kpiList"
        :key="kpi.title"
        :xs="12"
        :sm="6"
      >
        <div
          :class="cn(
            kpiCardBg(kpi.color), 'rounded-xl p-4 cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg',
          )"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <p class="text-xs text-gray-500 dark:text-gray-400 font-medium">
                {{ kpi.title }}
              </p>
              <p class="text-2xl font-bold text-gray-800 dark:text-white mt-1 tracking-tight">
                {{ kpi.value }}
              </p>
              <div class="flex items-center gap-1 mt-1.5">
                <Icon
                  :icon="kpi.trend >= 0 ? 'carbon:arrow-up' : 'carbon:arrow-down'"
                  :width="12"
                  :height="12"
                  :class="kpi.trend >= 0 ? 'text-emerald-500' : 'text-red-500'"
                />
                <span
                  :class="cn(
                    'text-xs font-medium',
                    kpi.trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                  )"
                >{{ Math.abs(kpi.trend) }}%</span>
                <span class="text-[11px] text-gray-400">{{ kpi.trendLabel }}</span>
              </div>
            </div>
            <div :class="kpiIconWrap(kpi.color)">
              <Icon
                :icon="kpi.icon"
                :width="22"
                :height="22"
              />
            </div>
          </div>
        </div>
      </a-col>
    </a-row>

    <!-- 主趋势图：全宽 -->
    <a-card
      :class="cardClassName"
      variant="borderless"
      :styles="{ body: { padding: '20px 24px' } }"
      class="mt-6"
    >
      <div class="flex items-center justify-between mb-4">
        <h3 :class="sectionTitleClassName">
          系统活动趋势
        </h3>
        <a-radio-group
          size="small"
          button-style="solid"
          default-value="pv"
          class="scale-90 origin-right"
        >
          <a-radio-button value="pv">
            PV / UV
          </a-radio-button>
          <a-radio-button value="api">
            API 调用
          </a-radio-button>
        </a-radio-group>
      </div>
      <div
        ref="mainTrendRef"
        class="w-full"
        style="height: 380px;"
      />
    </a-card>

    <!-- 第二行：分布 + 仪表盘 -->
    <a-row
      :gutter="[16,
                16]"
      class="mt-6"
    >
      <a-col
        :xs="24"
        :lg="12"
      >
        <a-card
          :class="cardClassName"
          variant="borderless"
          :styles="{ body: { padding: '20px 24px' } }"
        >
          <h3 :class="sectionTitleClassName">
            流量来源分布
          </h3>
          <div
            ref="trafficDistRef"
            class="w-full"
            style="height: 320px;"
          />
        </a-card>
      </a-col>
      <a-col
        :xs="24"
        :lg="12"
      >
        <a-card
          :class="cardClassName"
          variant="borderless"
          :styles="{ body: { padding: '20px 24px' } }"
        >
          <h3 :class="sectionTitleClassName">
            系统健康度
          </h3>
          <div
            ref="systemHealthRef"
            class="w-full"
            style="height: 320px;"
          />
        </a-card>
      </a-col>
    </a-row>

    <!-- 第三行：雷达图 + 热力图 -->
    <a-row
      :gutter="[16,
                16]"
    >
      <a-col
        :xs="24"
        :lg="12"
      >
        <a-card
          :class="cardClassName"
          variant="borderless"
          :styles="{ body: { padding: '20px 24px' } }"
        >
          <h3 :class="sectionTitleClassName">
            资源使用概况
          </h3>
          <div
            ref="resourceRadarRef"
            class="w-full"
            style="height: 320px;"
          />
        </a-card>
      </a-col>
      <a-col
        :xs="24"
        :lg="12"
      >
        <a-card
          :class="cardClassName"
          variant="borderless"
          :styles="{ body: { padding: '20px 24px' } }"
        >
          <h3 :class="sectionTitleClassName">
            用户活跃时段
          </h3>
          <div
            ref="activityHeatmapRef"
            class="w-full"
            style="height: 320px;"
          />
        </a-card>
      </a-col>
    </a-row>

    <!-- 第四行：漏斗 + 排行榜 -->
    <a-row
      :gutter="[16,
                16]"
      class="items-stretch mb-12"
    >
      <a-col
        :xs="24"
        :lg="10"
        class="mb-2"
      >
        <a-card
          :class="cn(cardClassName, 'h-full')"
          variant="borderless"
          :styles="{ body: { padding: '20px 24px', display: 'flex', flexDirection: 'column' } }"
        >
          <h3 :class="sectionTitleClassName">
            用户行为漏斗
          </h3>
          <div
            ref="userJourneyRef"
            class="w-full flex-1"
            style="min-height: 280px;"
          />
        </a-card>
      </a-col>
      <a-col
        :xs="24"
        :lg="14"
        class="mb-2"
      >
        <a-card
          :class="cn(cardClassName, 'h-full')"
          variant="borderless"
          :styles="{ body: { padding: '20px 24px', display: 'flex', flexDirection: 'column' } }"
        >
          <div class="flex items-center justify-between mb-4">
            <h3 :class="sectionTitleClassName">
              模块使用热度
            </h3>
            <a-tag
              color="blue"
              class="text-[11px]"
            >
              实时更新
            </a-tag>
          </div>
          <div
            ref="moduleRankRef"
            class="w-full flex-1"
            style="min-height: 280px;"
          />
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>
