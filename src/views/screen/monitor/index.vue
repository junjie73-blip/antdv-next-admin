<script setup lang="ts">
import type { Ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import * as echarts from 'echarts'
import { isPlainObject } from 'es-toolkit'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { getScreenMonitorData } from '@/api/screen'
import MarqueeNotice from '../components/MarqueeNotice.vue'
import RealtimeNumber from '../components/RealtimeNumber.vue'
import ScreenCard from '../components/ScreenCard.vue'
import ScreenHeader from '../components/ScreenHeader.vue'
import { useScreenAdapter } from '../composables/useScreenAdapter'

defineOptions({ name: 'ScreenMonitor' })

useScreenAdapter(1920, 1080)

// ======================== 数据层 ========================
const overview = ref({
  onlineUsers: 186,
  todayVisits: 5234,
  totalRequests: 128456,
  alertCount: 3,
  cpuUsage: 45.2,
  memUsage: 62.8,
  diskUsage: 55.3,
  networkIn: 86.4,
  networkOut: 42.1,
})

const trendData = ref<{ time: string, pv: number, uv: number, requests: number }[]>([])
const regionData = ref<{ name: string, value: number, users: number }[]>([])
const services = ref<any[]>([])
const alerts = ref<any[]>([])

// 计算属性：简化模板中的复杂表达式
const roundedNetworkIn = computed(() => Math.round(overview.value.networkIn))
const roundedNetworkOut = computed(() => Math.round(overview.value.networkOut))
const formattedAlerts = computed(() => alerts.value.map(a => `[${(a.level || '').toUpperCase()}] ${a.message}`))

// 请求类型分布数据
const requestTypes = ref([
  { name: 'GET', value: 68520, color: '#3b82f6' },
  { name: 'POST', value: 32150, color: '#22c55e' },
  { name: 'PUT', value: 18230, color: '#f59e0b' },
  { name: 'DELETE', value: 9556, color: '#ef4444' },
])

// 实时事件数据（可动态增长）
const realtimeEvents = ref([
  { time: '10:52:31', type: 'login', msg: '用户 张伟 从北京登录', level: 'info' },
  { time: '10:51:18', type: 'alert', msg: 'CPU 使用率超过阈值 (78%)', level: 'warning' },
  { time: '10:50:05', type: 'api', msg: 'API /user/list 响应时间 1.2s', level: 'warning' },
  { time: '10:48:42', type: 'security', msg: '检测到异常登录尝试 (47.96.12.33)', level: 'error' },
  { time: '10:47:15', type: 'success', msg: '数据库备份任务完成', level: 'success' },
  { time: '10:45:33', type: 'api', msg: 'API /order/create 调用成功', level: 'info' },
  { time: '10:44:01', type: 'login', msg: '用户 李娜 从上海登录', level: 'info' },
  { time: '10:42:28', type: 'alert', msg: '内存使用率达到 85%', level: 'warning' },
])

// 在线用户数据
const onlineUsers = ref(
  Array.from({ length: 50 }, (_, i) => ({
    name: ['张伟', '李娜', '王芳', '刘洋', '陈静', '杨帆', '赵敏', '黄磊', '周杰', '吴昊'][i % 10],
    ip: `192.168.${10 + (i % 20)}.${20 + (i * 3) % 250}`,
    status: Math.random() > 0.1 ? 'online' : 'away',
  })),
)

// 网络延迟数据
const latencyData = ref<Array<{ time: string, avg: number, p99: number }>>([])

// 延迟统计指标（用于底部填充展示）
const latencyStats = computed(() => {
  if (latencyData.value.length === 0)
    return { avg: '--', p99: '--', availability: '99.9' }
  const avgVal = Math.round(latencyData.value.reduce((s, d) => s + d.avg, 0) / latencyData.value.length)
  const p99Val = Math.round(latencyData.value.reduce((s, d) => s + d.p99, 0) / latencyData.value.length)
  // 模拟可用率（基于 P99 阈值估算）
  const availability = p99Val > 200 ? '99.5' : p99Val > 150 ? '99.7' : '99.9'
  return { avg: avgVal, p99: p99Val, availability }
})

// 攻击来源 TOP5 数据
const attackSources = ref([
  { name: '美国 (45.33.x.x)', value: 2847, color: '#ef4444' },
  { name: '俄罗斯 (91.12x.x)', value: 1923, color: '#f59e0b' },
  { name: '印度 (103.x.x.x)', value: 1456, color: '#f97316' },
  { name: '巴西 (177.x.x.x)', value: 892, color: '#eab308' },
  { name: '未知来源', value: 634, color: '#6b7280' },
])

// 安全告警实时数据
const securityAlerts = ref([
  { time: '10:53:01', level: 'critical', msg: '检测到 SQL 注入攻击尝试，来源 IP: 45.33.78.12' },
  { time: '10:52:45', level: 'high', msg: '暴力破解登录失败已达 50 次，已自动封禁 IP: 91.102.44.7' },
  { time: '10:52:18', level: 'medium', msg: '异常文件上传行为检测：/upload/shell.jsp' },
  { time: '10:51:55', level: 'high', msg: 'XSS 攻击拦截：&lt;script&gt;alert(1)&lt;/script&gt;' },
  { time: '10:51:30', level: 'low', msg: '可疑目录扫描：/admin, /backup, /.git' },
])

// ======================== 图表实例管理 ========================
// useTemplateRef 参数必须和模板 ref 属性值完全一致
const pvChartRef = useTemplateRef<HTMLDivElement>('pvChartRef')
const regionBarRef = useTemplateRef<HTMLDivElement>('regionBarRef')
const gaugeRef = useTemplateRef<HTMLDivElement>('gaugeRef')
const heatmapRef = useTemplateRef<HTMLDivElement>('heatmapRef')
const pieChartRef = useTemplateRef<HTMLDivElement>('pieChartRef')
const latencyChartRef = useTemplateRef<HTMLDivElement>('latencyChartRef')
const attackSourceRef = useTemplateRef<HTMLDivElement>('attackSourceRef')
const charts = new Map<string, echarts.ECharts>()

/** 安全等待 DOM 尺寸就绪后执行回调 */
function whenReady(name: string, refEl: Ref<HTMLDivElement | undefined>, cb: (el: HTMLDivElement) => void) {
  const el = refEl.value
  if (!el || charts.has(name))
    return
  if (el.offsetWidth > 0 && el.offsetHeight > 0) { cb(el); return }
  let done = false
  const ob = new ResizeObserver((entries) => {
    if (done)
      return
    for (const e of entries) {
      if (e.contentRect.width > 0 && e.contentRect.height > 0) {
        done = true; ob.disconnect()
        const t = refEl.value; if (t && !charts.has(name))
          cb(t)
        break
      }
    }
  })
  ob.observe(el)
  setTimeout(() => {
    if (!done && !charts.has(name)) {
      done = true; ob.disconnect(); const t = refEl.value; if (t)
        cb(t)
    }
  }, 3000)
}

// ======================== 图表配置函数 =========================

/** PV/UV 趋势图 */
function buildPVOption(data: typeof trendData.value) {
  const palette = { line: '#3b82f6', uv: '#22c55e', bar: '#f59e0b' }
  return {
    grid: { left: 50, right: 20, top: 25, bottom: 30 },
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(17,24,39,0.95)', borderColor: '#334155', textStyle: { color: '#e2e8f0', fontSize: 12 }, axisPointer: { type: 'cross' } },
    legend: { data: ['PV', 'UV', '请求数'], top: 0, right: 0, textStyle: { color: '#94a3b8', fontSize: 11 }, itemWidth: 14, itemHeight: 2 },
    xAxis: { type: 'category', boundaryGap: false, data: data.map(d => d.time), axisLabel: { color: '#64748b', fontSize: 10, interval: 5 }, axisLine: { lineStyle: { color: '#334155' } }, axisTick: { show: false }, splitLine: { show: false } },
    yAxis: [
      { type: 'value', axisLabel: { color: '#64748b', fontSize: 10 }, splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } } },
      { type: 'value', axisLabel: { color: '#64748b', fontSize: 10 }, splitLine: { show: false } },
    ],
    series: [
      { name: 'PV', type: 'line', smooth: true, symbol: 'none', data: data.map(d => d.pv), lineStyle: { color: palette.line, width: 2 }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(59,130,246,0.3)' }, { offset: 1, color: 'rgba(59,130,246,0.02)' }]) } },
      { name: 'UV', type: 'line', smooth: true, symbol: 'none', data: data.map(d => d.uv), lineStyle: { color: palette.uv, width: 2, type: 'dashed' } },
      { name: '请求数', type: 'bar', barWidth: 8, yAxisIndex: 1, data: data.map(d => d.requests), itemStyle: { borderRadius: [2, 2, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#f59e0b' }, { offset: 1, color: 'rgba(245,158,11,0.15)' }]) } },
    ],
    animationDuration: 1500,
  }
}

/** 地区分布柱状图 */
function buildRegionOption(data: typeof regionData.value) {
  const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#06b6d4', '#84cc16', '#6366f1']
  return {
    grid: { left: 60, right: 20, top: 20, bottom: 30 },
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(17,24,39,0.95)', borderColor: '#334155', textStyle: { color: '#e2e8f0', fontSize: 12 } },
    xAxis: { type: 'value', axisLabel: { color: '#64748b', fontSize: 10 }, splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } } },
    yAxis: { type: 'category', data: data.map(r => r.name).reverse(), axisLabel: { color: '#94a3b8', fontSize: 11 }, axisLine: { lineStyle: { color: '#334155' } }, axisTick: { show: false } },
    series: [{
      type: 'bar',
      barWidth: 14,
      data: data.map(r => r.value).reverse(),
      itemStyle: {
        borderRadius: [0, 4, 4, 0],
        color(params: any) {
          const c = colors[params.dataIndex % colors.length]
          return new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: c }, { offset: 1, color: `${c}33` }])
        },
      },
      animationDuration: 1200,
    }],
  }
}

/** CPU/内存仪表盘 */
function buildGaugeOption(cpu: number, mem: number) {
  return {
    series: [
      {
        type: 'gauge',
        center: ['30%', '55%'],
        radius: '75%',
        startAngle: 220,
        endAngle: -40,
        min: 0,
        max: 100,
        splitNumber: 5,
        axisLine: { lineStyle: { width: 12, color: [[0.6, '#22c55e'], [0.85, '#f59e0b'], [1, '#ef4444']] } },
        pointer: { length: '55%', width: 4, itemStyle: { color: 'auto' } },
        axisTick: { distance: -16, length: 6, lineStyle: { color: '#334155', width: 1 } },
        splitLine: { distance: -18, length: 14, lineStyle: { color: '#334155', width: 2 } },
        axisLabel: { distance: -22, color: '#64748b', fontSize: 9 },
        detail: { valueAnimation: true, formatter: '{value}%', color: '#e2e8f0', fontSize: 18, fontWeight: 'bold', offsetCenter: [0, '70%'] },
        title: { offsetCenter: [0, '95%'], color: '#94a3b8', fontSize: 11 },
        data: [{ value: Math.round(cpu), name: 'CPU' }],
      },
      {
        type: 'gauge',
        center: ['70%', '55%'],
        radius: '75%',
        startAngle: 220,
        endAngle: -40,
        min: 0,
        max: 100,
        splitNumber: 5,
        axisLine: { lineStyle: { width: 12, color: [[0.6, '#22c55e'], [0.85, '#f59e0b'], [1, '#ef4444']] } },
        pointer: { length: '55%', width: 4, itemStyle: { color: 'auto' } },
        axisTick: { distance: -16, length: 6, lineStyle: { color: '#334155', width: 1 } },
        splitLine: { distance: -18, length: 14, lineStyle: { color: '#334155', width: 2 } },
        axisLabel: { distance: -22, color: '#64748b', fontSize: 9 },
        detail: { valueAnimation: true, formatter: '{value}%', color: '#e2e8f0', fontSize: 18, fontWeight: 'bold', offsetCenter: [0, '70%'] },
        title: { offsetCenter: [0, '95%'], color: '#94a3b8', fontSize: 11 },
        data: [{ value: Math.round(mem), name: '内存' }],
      },
    ],
    animationDuration: 1500,
  }
}

/** 热力图 */
function buildHeatmapOption() {
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`)
  const data: number[][][] = []
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const base = d < 5 ? ((h >= 9 && h <= 18) ? 80 : 20) : ((h >= 19 && h <= 23) ? 70 : 15)
      data.push([h, d, base + Math.floor(Math.random() * 40)])
    }
  }
  return {
    tooltip: { position: 'top', backgroundColor: 'rgba(17,24,39,0.95)', borderColor: '#334155', textStyle: { color: '#e2e8f0', fontSize: 12 }, formatter(p: any) { return `${hours[p.data[0]]}<br/>${days[p.data[1]]}<br/>活跃度: ${p.data[2]}` } },
    grid: { left: 50, right: 20, top: 10, bottom: 35 },
    xAxis: { type: 'category', data: hours, axisLabel: { color: '#64748b', fontSize: 9, interval: 3 }, splitArea: { show: true, areaStyle: { color: ['#1e293b', '#0f172a'] } } },
    yAxis: { type: 'category', data: days, axisLabel: { color: '#94a3b8', fontSize: 10 }, splitArea: { show: true, areaStyle: { color: ['#1e293b', '#0f172a'] } } },
    visualMap: { min: 0, max: 100, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#0f172a', '#1e3a5f', '#2563eb', '#3b82f6', '#93c5fd'] }, textStyle: { color: '#64748b', fontSize: 10 } },
    series: [{ type: 'heatmap', data, label: { show: false }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } } }],
    animationDuration: 1500,
  }
}

/** 请求类型分布饼图 */
function buildPieOption() {
  return {
    tooltip: { trigger: 'item', backgroundColor: 'rgba(17,24,39,0.95)', borderColor: '#334155', textStyle: { color: '#e2e8f0' }, formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'vertical', right: '4%', top: 'center', textStyle: { color: '#94a3b8', fontSize: 11 }, itemWidth: 10, itemHeight: 10, itemGap: 12 },
    series: [{
      type: 'pie',
      radius: ['42%', '72%'],
      center: ['38%', '50%'],
      avoidLabelOverlap: true,
      padAngle: 3,
      itemStyle: { borderRadius: 6, borderColor: '#0a0e27', borderWidth: 2 },
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 13, fontWeight: 'bold', color: '#e2e8f0' }, scaleSize: 8 },
      data: requestTypes.value.map(t => ({ value: t.value, name: t.name, itemStyle: { color: t.color } })),
      animationDuration: 1200,
    }],
  }
}

/** 网络延迟趋势 */
function buildLatencyOption(data: typeof latencyData.value) {
  return {
    grid: { left: 45, right: 15, top: 15, bottom: 25 },
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(17,24,39,0.95)', borderColor: '#334155', textStyle: { color: '#e2e8f0', fontSize: 11 } },
    legend: { data: ['平均延迟', 'P99'], top: 0, right: 0, textStyle: { color: '#94a3b8', fontSize: 10 }, itemWidth: 12, itemHeight: 2 },
    xAxis: { type: 'category', boundaryGap: false, data: data.map(d => d.time), axisLabel: { color: '#64748b', fontSize: 9, interval: 4 }, axisLine: { lineStyle: { color: '#334155' } }, axisTick: { show: false } },
    yAxis: { type: 'value', axisLabel: { color: '#64748b', fontSize: 9, formatter: '{value}ms' }, splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } } },
    series: [
      { name: '平均延迟', type: 'line', smooth: true, symbol: 'none', data: data.map(d => d.avg), lineStyle: { color: '#06b6d4', width: 2 }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(6,182,212,0.25)' }, { offset: 1, color: 'rgba(6,182,212,0.02)' }]) } },
      { name: 'P99', type: 'line', smooth: true, symbol: 'none', data: data.map(d => d.p99), lineStyle: { color: '#f43f5e', width: 1.5, type: 'dashed' } },
    ],
    animationDuration: 1200,
  }
}

/** 攻击来源 TOP5（横向柱状图，安全威胁态势） */
function buildAttackSourceOption() {
  const sorted = [...attackSources.value].sort((a, b) => b.value - a.value)
  return {
    grid: { left: '2%', right: '8%', top: '3%', bottom: '1%', containLabel: true },
    xAxis: { type: 'value', max: 3500, axisLabel: { color: '#64748b', fontSize: 9 }, splitLine: { lineStyle: { color: '#1e293b', type: 'dashed', opacity: 0.5 } } },
    yAxis: { type: 'category', data: sorted.map(d => d.name), axisLabel: { color: '#94a3b8', fontSize: 10 }, axisTick: { show: false }, axisLine: { show: false }, inverse: true },
    series: [{
      type: 'bar',
      data: sorted.map(d => ({
        value: d.value,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: `${d.color}20` },
            { offset: 1, color: d.color },
          ]),
          borderRadius: [0, 4, 4, 0],
        },
      })),
      barWidth: 14,
      label: { show: true, position: 'right', color: '#e2e8f0', fontSize: 10, formatter: '{c}' },
      animationDuration: 1000,
      animationEasing: 'cubicOut',
    }],
  }
}

// ======================== 统一更新所有图表 ========================
function updateAllCharts() {
  const pv = charts.get('pv')
  if (pv && trendData.value.length)
    pv.setOption(buildPVOption(trendData.value))

  const region = charts.get('region')
  if (region && regionData.value.length)
    region.setOption(buildRegionOption(regionData.value))

  const gauge = charts.get('gauge')
  if (gauge)
    gauge.setOption(buildGaugeOption(overview.value.cpuUsage, overview.value.memUsage))

  const pie = charts.get('pie')
  if (pie)
    pie.setOption(buildPieOption())

  const latency = charts.get('latency')
  if (latency && latencyData.value.length)
    latency.setOption(buildLatencyOption(latencyData.value))

  const attack = charts.get('attack')
  if (attack)
    attack.setOption(buildAttackSourceOption())
}

/** 完全销毁所有图表和清理副作用 */
function disposeAll() {
  charts.forEach(c => c.dispose())
  charts.clear()
  // 清理 screen-container 的样式（防止污染后续页面）
  const container = document.getElementById('screen-container')
  if (container) {
    container.style.transform = ''
    container.style.transformOrigin = ''
    container.style.width = ''
    container.style.height = ''
  }
}

// PerfectScrollbar 配置
const psOptions = { wheelPropagation: true, suppressScrollX: true }

// 定时器引用（必须在顶层声明，以便同步清理）
let refreshTimer: ReturnType<typeof setInterval> | null = null

// ======================== 生命周期 ========================
onMounted(async () => {
  // 阶段1：创建所有图表实例
  initChartImmediately('pv', pvChartRef, (el) => { charts.set('pv', echarts.init(el, 'dark')) })
  initChartImmediately('region', regionBarRef, (el) => { charts.set('region', echarts.init(el, 'dark')) })
  initChartImmediately('gauge', gaugeRef, (el) => { charts.set('gauge', echarts.init(el, 'dark')) })
  initChartImmediately('heatmap', heatmapRef, (el) => { const instance = echarts.init(el, 'dark'); charts.set('heatmap', instance); instance.setOption(buildHeatmapOption()) })
  initChartImmediately('pie', pieChartRef, (el) => { charts.set('pie', echarts.init(el, 'dark')) })
  initChartImmediately('latency', latencyChartRef, (el) => { charts.set('latency', echarts.init(el, 'dark')) })
  initChartImmediately('attack', attackSourceRef, (el) => { charts.set('attack', echarts.init(el, 'dark')) })

  // 阶段2：加载数据
  try {
    const res = await getScreenMonitorData()
    const raw = (res as any)?.data ?? res
    const data = (raw as any)?.data ?? raw

    if (isPlainObject(data) && 'overview' in data) {
      overview.value = (data as any).overview ?? overview.value
      trendData.value = (data as any).trend ?? []
      regionData.value = (data as any).regions ?? []
      services.value = (data as any).services ?? []
      alerts.value = (data as any).alerts ?? []

      // 生成网络延迟数据
      latencyData.value = trendData.value.slice(-12).map(d => ({
        time: d.time,
        avg: Math.floor(30 + Math.random() * 80),
        p99: Math.floor(100 + Math.random() * 200),
      }))
    }
    else {
      console.warn('[Monitor] API 返回格式异常:', { res, raw, data })
    }

    await nextTick()
    updateAllCharts()
  }
  catch (err) {
    console.warn('[Monitor] 数据加载失败，使用默认值:', err)
    latencyData.value = Array.from({ length: 12 }, (_, i) => ({
      time: `${String(i * 2).padStart(2, '0')}:00`,
      avg: Math.floor(40 + Math.random() * 60),
      p99: Math.floor(120 + Math.random() * 150),
    }))
    await nextTick()
    updateAllCharts()
  }

  // 模拟实时刷新（保存 timer 引用到顶层变量）
  refreshTimer = setInterval(() => {
    overview.value.onlineUsers += Math.floor(Math.random() * 10) - 4
    overview.value.todayVisits += Math.floor(Math.random() * 20)
    overview.value.totalRequests += Math.floor(Math.random() * 500)
    overview.value.cpuUsage = Number(Math.max(10, Math.min(95, overview.value.cpuUsage + (Math.random() - 0.5) * 5)).toFixed(1))
    overview.value.memUsage = Number(Math.max(30, Math.min(90, overview.value.memUsage + (Math.random() - 0.5) * 3)).toFixed(1))
    // 更新延迟数据
    if (latencyData.value.length > 0) {
      const last = latencyData.value[latencyData.value.length - 1]!
      latencyData.value.push({
        time: last.time,
        avg: Math.max(20, Math.min(150, last.avg + Math.floor(Math.random() * 20 - 10))),
        p99: Math.max(80, Math.min(300, last.p99 + Math.floor(Math.random() * 40 - 20))),
      })
      if (latencyData.value.length > 24)
        latencyData.value.shift()
      const latencyChart = charts.get('latency')
      if (latencyChart)
        latencyChart.setOption(buildLatencyOption(latencyData.value))
    }
    // 模拟新事件
    if (Math.random() > 0.6) {
      const eventTemplates = [
        { type: 'api', msg: 'API 响应超时警告', level: 'warning' },
        { type: 'login', msg: `用户 ${['张伟', '李娜', '王芳', '刘洋'][Math.floor(Math.random() * 4)]} 登录`, level: 'info' },
        { type: 'alert', msg: 'CPU/Memory 使用率异常', level: Math.random() > 0.5 ? 'warning' : 'error' },
        { type: 'success', msg: '定时任务执行完成', level: 'success' },
      ]
      const evt = eventTemplates[Math.floor(Math.random() * eventTemplates.length)]!
      realtimeEvents.value.unshift({ time: new Date().toLocaleTimeString('zh-CN'), ...evt })
      if (realtimeEvents.value.length > 50)
        realtimeEvents.value.pop()
    }
    // 模拟安全告警动态更新
    if (Math.random() > 0.5) {
      const alertTemplates = [
        { level: 'critical' as const, msg: `检测到 ${['SQL注入', 'XSS攻击', '命令注入', 'SSRF攻击'][Math.floor(Math.random() * 4)]} 尝试，来源: ${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}` },
        { level: 'high' as const, msg: `暴力破解攻击：IP ${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.x.x 已尝试 ${10 + Math.floor(Math.random() * 90)} 次` },
        { level: 'medium' as const, msg: `异常访问：${['敏感路径扫描', '越权尝试', '大量404请求', '可疑User-Agent'][Math.floor(Math.random() * 4)]}` },
        { level: 'low' as const, msg: `安全提醒：${['弱密码检测', '证书即将过期', '未加密传输', '登录地点变更'][Math.floor(Math.random() * 4)]}` },
      ]
      const sa = alertTemplates[Math.floor(Math.random() * alertTemplates.length)]!
      securityAlerts.value.unshift({ time: new Date().toLocaleTimeString('zh-CN'), ...sa })
      if (securityAlerts.value.length > 15)
        securityAlerts.value.pop()
    }
    // 更新攻击来源数据
    if (Math.random() > 0.7) {
      attackSources.value = attackSources.value.map(s => ({ ...s, value: Math.max(100, s.value + Math.floor(Math.random() * 200 - 80)) }))
      const attackChart = charts.get('attack')
      if (attackChart)
        attackChart.setOption(buildAttackSourceOption())
    }
  }, 5000)
})

function initChartImmediately(name: string, refEl: Ref<HTMLDivElement | undefined>, initFn: (el: HTMLDivElement) => void) {
  const el = refEl.value
  if (!el || charts.has(name))
    return
  if (el.offsetWidth > 0 && el.offsetHeight > 0) { initFn(el); return }
  whenReady(name, refEl, initFn)
}

watch([() => overview.value.cpuUsage, () => overview.value.memUsage], () => {
  updateAllCharts()
}, { deep: true })

useEventListener(window, 'resize', () => charts.forEach(c => c.resize()))

// 关键：确保组件卸载时完全清理所有资源（同步注册）
onBeforeUnmount(() => {
  // 清理定时器
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
  // 销毁所有 ECharts 实例并清理容器样式
  disposeAll()
})

// ======================== 工具函数 ========================
function serviceStatusColor(status: string): string {
  return status === 'healthy' ? 'text-emerald-400' : status === 'warning' ? 'text-yellow-400' : 'text-red-400'
}

function eventLevelColor(level: string): string {
  const map: Record<string, string> = {
    info: 'bg-blue-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
    success: 'bg-emerald-500',
  }
  return map[level] || 'bg-gray-500'
}

function eventLevelText(level: string): string {
  const map: Record<string, string> = {
    info: 'text-blue-400',
    warning: 'text-yellow-400',
    error: 'text-red-400',
    success: 'text-emerald-400',
  }
  return map[level] || 'text-gray-400'
}

function securityAlertLevelColor(level: string): string {
  const map: Record<string, string> = { critical: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-yellow-500', low: 'bg-blue-400' }
  return map[level] || 'bg-gray-500'
}

function securityAlertLevelText(level: string): string {
  const map: Record<string, string> = { critical: 'text-red-400', high: 'text-orange-400', medium: 'text-yellow-400', low: 'text-blue-300' }
  return map[level] || 'text-gray-400'
}
</script>

<template>
  <!-- 大屏容器（允许滚动以适应不同屏幕） -->
  <div
    id="screen-container"
    class="w-screen min-h-screen overflow-auto bg-[#0a0e27] text-white"
  >
    <!-- 头部 -->
    <ScreenHeader title="系统实时监控大屏" />

    <!-- 主体内容（使用 flex 自适应高度而非固定 vh） -->
    <div class="grid grid-cols-12 gap-3 p-3 pb-4 items-start">
      <!-- 左侧栏 -->
      <div class="col-span-3 flex flex-col gap-3">
        <!-- 核心指标卡片 -->
        <div class="grid grid-cols-2 gap-3">
          <ScreenCard>
            <RealtimeNumber
              :value="overview.onlineUsers"
              suffix="人"
            />
            <span class="text-[10px] text-blue-300/50 mt-1 block">在线用户</span>
          </ScreenCard>
          <ScreenCard>
            <RealtimeNumber :value="overview.todayVisits" />
            <span class="text-[10px] text-blue-300/50 mt-1 block">今日访问(PV)</span>
          </ScreenCard>
          <ScreenCard>
            <RealtimeNumber :value="overview.alertCount" />
            <span class="text-[10px] text-blue-300/50 mt-1 block">告警数</span>
          </ScreenCard>
          <ScreenCard>
            <RealtimeNumber
              :value="roundedNetworkIn"
              suffix="MB/s"
            />
            <span class="text-[10px] text-blue-300/50 mt-1 block">网络入流量</span>
          </ScreenCard>
        </div>

        <!-- 在线用户列表 -->
        <ScreenCard
          title="在线用户"
          class="min-h-[200px]"
        >
          <PerfectScrollbar
            :options="psOptions"
            class="h-full"
            style="max-height: calc(100vh - 500px)"
          >
            <div class="space-y-2 pr-1">
              <div
                v-for="(user, idx) in onlineUsers"
                :key="idx"
                class="flex items-center gap-2.5 px-2 py-1.5 rounded bg-blue-900/20 hover:bg-blue-800/30 transition-colors"
              >
                <div class="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-[10px] font-bold shrink-0">
                  {{ user.name[0] }}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-xs text-blue-100/80 truncate">
                    {{ user.name }}
                  </div>
                  <div class="text-[10px] text-blue-300/40 font-mono">
                    {{ user.ip }}
                  </div>
                </div>
                <span
                  class="w-1.5 h-1.5 rounded-full shrink-0"
                  :class="user.status === 'online' ? 'bg-emerald-400' : 'bg-gray-500'"
                />
              </div>
            </div>
          </PerfectScrollbar>
        </ScreenCard>
      </div>

      <!-- 中间区域 -->
      <div class="col-span-6 flex flex-col gap-3">
        <!-- PV/UV 趋势图（主图） -->
        <ScreenCard class="min-h-[320px]">
          <div
            ref="pvChartRef"
            class="w-full"
            style="height: 300px"
          />
        </ScreenCard>

        <!-- 第二行：热力图 + 请求类型饼图 -->
        <div class="grid grid-cols-2 gap-3">
          <ScreenCard
            title="用户活跃时段"
            class="min-h-[220px]"
          >
            <div
              ref="heatmapRef"
              class="w-full"
              style="height: 190px"
            />
          </ScreenCard>
          <ScreenCard
            title="请求类型分布"
            class="min-h-[220px]"
          >
            <div
              ref="pieChartRef"
              class="w-full"
              style="height: 190px"
            />
          </ScreenCard>
        </div>

        <!-- 第三行：网络延迟趋势 + 实时事件流 -->
        <div class="grid grid-cols-2 gap-3">
          <ScreenCard
            title="网络延迟趋势"
            class="min-h-[220px] flex flex-col"
          >
            <div
              ref="latencyChartRef"
              class="w-full flex-shrink-0"
              style="height: 155px"
            />
            <!-- 统计指标：填充底部空隙 -->
            <div class="flex items-center gap-3 mt-2 px-1 text-[11px]">
              <div class="flex items-center gap-1.5">
                <span class="w-2 h-0.5 rounded bg-cyan-400" />
                <span class="text-slate-400">平均</span>
                <span class="text-cyan-300 font-mono font-medium">{{ latencyStats.avg }}ms</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span
                  class="w-2 h-0.5 rounded bg-rose-400"
                  style="border-style: dashed;"
                />
                <span class="text-slate-400">P99</span>
                <span class="text-rose-300 font-mono font-medium">{{ latencyStats.p99 }}ms</span>
              </div>
              <div class="flex items-center gap-1.5 ml-auto">
                <span class="text-slate-500">可用率</span>
                <span
                  class="font-mono font-medium"
                  :class="[latencyStats.availability >= 99.9 ? 'text-emerald-400' : 'text-amber-400']"
                >{{ latencyStats.availability }}%</span>
              </div>
            </div>
          </ScreenCard>
          <ScreenCard
            title="实时事件流"
            class="min-h-[220px] overflow-hidden flex flex-col"
          >
            <PerfectScrollbar
              :options="psOptions"
              class="flex-1 min-h-0"
              style="max-height: 190px"
            >
              <div class="space-y-1.5 pr-1">
                <div
                  v-for="(evt, idx) in realtimeEvents"
                  :key="idx"
                  class="flex items-start gap-2 text-[11px] px-2 py-1.5 rounded bg-blue-900/15 hover:bg-blue-800/25 transition-colors"
                >
                  <span
                    :class="eventLevelColor(evt.level)"
                    class="w-1 h-1 rounded-full shrink-0 mt-1.5"
                  />
                  <span class="text-blue-300/40 font-mono shrink-0">{{ evt.time }}</span>
                  <span
                    :class="eventLevelText(evt.level)"
                    class="shrink-0"
                  >{{ evt.type.toUpperCase() }}</span>
                  <span class="text-blue-100/70 truncate">{{ evt.msg }}</span>
                </div>
              </div>
            </PerfectScrollbar>
          </ScreenCard>
        </div>
      </div>

      <!-- 右侧栏 -->
      <div class="col-span-3 flex flex-col gap-3">
        <!-- 总请求数 -->
        <ScreenCard>
          <div class="text-center py-1">
            <RealtimeNumber :value="overview.totalRequests" />
            <span class="text-[10px] text-blue-300/50 block mt-1">总请求数</span>
          </div>
        </ScreenCard>

        <!-- 资源使用率 -->
        <ScreenCard
          title="资源使用率"
          class="min-h-[220px]"
        >
          <div
            ref="gaugeRef"
            class="w-full"
            style="height: 190px"
          />
        </ScreenCard>

        <!-- 地区分布 -->
        <ScreenCard
          title="地区用户分布 TOP9"
          class="min-h-[260px]"
        >
          <div
            ref="regionBarRef"
            class="w-full"
            style="height: 230px"
          />
        </ScreenCard>

        <!-- 服务状态 + 最近告警 -->
        <div class="grid grid-cols-1 gap-3">
          <ScreenCard
            title="服务健康状态"
            class="min-h-0"
          >
            <div class="space-y-1.5">
              <div
                v-for="svc in services"
                :key="svc.name"
                class="flex items-center justify-between px-2 py-1.5 rounded bg-blue-900/20"
              >
                <span class="text-xs text-blue-100/80">{{ svc.name }}</span>
                <div class="flex items-center gap-2">
                  <span class="text-[10px] text-blue-300/50">{{ svc.uptime }}</span>
                  <span
                    :class="serviceStatusColor(svc.status)"
                    class="text-[10px] flex items-center gap-1"
                  >
                    <span
                      class="w-1.5 h-1.5 rounded-full inline-block"
                      :class="svc.status === 'healthy' ? 'bg-emerald-400' : svc.status === 'warning' ? 'bg-yellow-400' : 'bg-red-400'"
                    />
                    {{ svc.status === 'healthy' ? '正常' : svc.status === 'warning' ? '警告' : '异常' }}
                  </span>
                </div>
              </div>
            </div>
          </ScreenCard>
          <ScreenCard
            title="最近告警"
            class="min-h-0 overflow-hidden"
          >
            <MarqueeNotice :items="formattedAlerts" />
          </ScreenCard>
        </div>
      </div>
    </div>

    <!-- 安全威胁态势（底部新增行） -->
    <div class="grid grid-cols-12 gap-3 px-3 pb-4">
      <!-- 攻击来源 TOP5 -->
      <div class="col-span-5">
        <ScreenCard
          title="攻击来源 TOP5"
          class="min-h-[180px]"
        >
          <div
            ref="attackSourceRef"
            class="w-full"
            style="height: 150px"
          />
        </ScreenCard>
      </div>
      <!-- 实时安全告警 -->
      <div class="col-span-7">
        <ScreenCard
          title="实时安全告警"
          class="min-h-[180px] overflow-hidden flex flex-col"
        >
          <PerfectScrollbar
            :options="psOptions"
            class="flex-1 min-h-0"
            style="max-height: 150px"
          >
            <div class="space-y-1 pr-1">
              <div
                v-for="(alert, idx) in securityAlerts"
                :key="idx"
                class="flex items-start gap-2 text-[11px] px-2 py-1 rounded bg-red-900/10 hover:bg-red-900/20 transition-colors"
              >
                <span
                  :class="securityAlertLevelColor(alert.level)"
                  class="w-1 h-1 rounded-full shrink-0 mt-1.5"
                />
                <span class="text-blue-300/40 font-mono shrink-0">{{ alert.time }}</span>
                <span
                  :class="securityAlertLevelText(alert.level)"
                  class="shrink-0 text-[9px] uppercase font-bold"
                >{{ alert.level }}</span>
                <span class="text-red-100/70 truncate">{{ alert.msg }}</span>
              </div>
            </div>
          </PerfectScrollbar>
        </ScreenCard>
      </div>
    </div>

    <!-- 底部信息栏 -->
    <div class="h-6 bg-blue-950/80 border-t border-blue-500/10 flex items-center justify-center text-[10px] text-blue-300/30 mt-3">
      <span>数据刷新于 {{ new Date().toLocaleString('zh-CN') }} &nbsp;|&nbsp; Antdv Next Admin Security Monitor &nbsp;|&nbsp; v1.0.0</span>
    </div>
  </div>
</template>
