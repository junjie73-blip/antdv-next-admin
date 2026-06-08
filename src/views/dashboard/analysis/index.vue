<script setup lang="ts">
import type { Ref } from 'vue'
import { faker } from '@faker-js/faker/locale/zh_CN'
import { Icon } from '@iconify/vue'
import { useEventListener } from '@vueuse/core'
import { message } from 'antdv-next'
import * as echarts from 'echarts'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/modules/app'
import { cn } from '@/utils/cn'

defineOptions({ name: 'DashboardAnalysis' })

const router = useRouter()
const appStore = useAppStore()

// ========== Tab 切换状态 ==========
const activeTab = ref('overview')
const containerClassName = cn('p-6 space-y-6')

// ========== 主题相关 ==========
const isDark = computed(() => appStore.themeMode === 'dark')

// ========== 图表实例管理 ==========
const charts = new Map<string, echarts.ECharts>()

// ECharts DOM 引用
const mainTrendRef = ref<HTMLDivElement>()
const trafficDistRef = ref<HTMLDivElement>()
const systemHealthRef = ref<HTMLDivElement>()
const resourceRadarRef = ref<HTMLDivElement>()
const activityHeatmapRef = ref<HTMLDivElement>()
const userJourneyRef = ref<HTMLDivElement>()
const moduleRankRef = ref<HTMLDivElement>()

// ========== 样式类名（总览） ==========
const overviewContainerClassName = computed(() =>
  cn('space-y-6'),
)

/** PerfectScrollbar 统一配置 */
const scrollbarOptions = { wheelPropagation: true, suppressScrollX: true }
const panelScrollHeight = cn('h-[380px]')

// ========== 样式类名（数据分析） ==========
const analyticsCardClassName = cn(
  'rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900',
  'transition-all duration-300 hover:shadow-md',
)
const sectionTitleClassName = cn(
  'text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4',
)

// ═══════════════════════════════════════════
// 📊 总览仪表盘数据（原 dashboard/index.vue）
// ═══════════════════════════════════════════

// 设置中文 locale 并固定种子，保证每次刷新数据一致但真实
faker.seed(42)

// 统计卡片数据（faker 生成）
interface StatCard {
  title: string
  value: string
  icon: string
  trend: number
  trendLabel: string
  color: string
}

const statCards: StatCard[] = [
  {
    title: '今日访问',
    value: faker.number.int({ min: 1200, max: 5000 }).toLocaleString(),
    icon: 'carbon:view',
    trend: faker.number.float({ min: -15, max: 25, fractionDigits: 1 }),
    trendLabel: '较昨日',
    color: 'blue',
  },
  {
    title: '在线用户',
    value: faker.number.int({ min: 80, max: 300 }).toString(),
    icon: 'carbon:user-multiple',
    trend: faker.number.float({ min: -10, max: 10, fractionDigits: 1 }),
    trendLabel: '较昨日',
    color: 'green',
  },
  {
    title: '消息通知',
    value: faker.number.int({ min: 5, max: 50 }).toString(),
    icon: 'carbon:notification',
    trend: faker.number.float({ min: -5, max: 20, fractionDigits: 1 }),
    trendLabel: '较上周',
    color: 'orange',
  },
  {
    title: '待办事项',
    value: faker.number.int({ min: 3, max: 20 }).toString(),
    icon: 'carbon:task',
    trend: faker.number.float({ min: -20, max: 5, fractionDigits: 1 }),
    trendLabel: '较昨日',
    color: 'purple',
  },
]

function getStatCardBg(color: string) {
  const map: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-950/30',
    green: 'bg-emerald-50 dark:bg-emerald-950/30',
    orange: 'bg-orange-50 dark:bg-orange-950/30',
    purple: 'bg-violet-50 dark:bg-violet-950/30',
  }
  return map[color] || map.blue
}

function getStatIconBg(color: string) {
  const map: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
    green: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400',
    purple: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400',
  }
  return map[color] || map.blue
}

// 访问趋势图数据（近7天，faker 生成）
const dayLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const chartData = dayLabels.map(day => ({
  day,
  value: faker.number.int({ min: 800, max: 3500 }),
}))

const maxValue = Math.max(...chartData.map(d => d.value))

// SVG 面积图路径生成
function generateAreaPath() {
  const width = 700
  const height = 200
  const padding = { top: 10, right: 10, bottom: 30, left: 40 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom
  const stepX = chartW / (chartData.length - 1)

  const points = chartData.map((d, i) => ({
    x: padding.left + i * stepX,
    y: padding.top + chartH - (d.value / maxValue) * chartH,
  }))

  let areaPath = `M ${padding.left} ${padding.top + chartH}`
  points.forEach((p) => {
    areaPath += ` L ${p.x} ${p.y}`
  })
  areaPath += ` L ${points[points.length - 1].x} ${padding.top + chartH} Z`

  let linePath = `M ${points[0].x} ${points[0].y}`
  points.slice(1).forEach((p) => {
    linePath += ` L ${p.x} ${p.y}`
  })

  return { areaPath, linePath, points, padding, width, height, chartH }
}

const chart = computed(() => generateAreaPath())

// 快捷操作
interface QuickAction {
  label: string
  icon: string
  route: string
  color: string
}

const quickActions: QuickAction[] = [
  { label: '用户管理', icon: 'ant-design:user-outlined', route: '/system/user', color: 'blue' },
  { label: '角色管理', icon: 'ant-design:team-outlined', route: '/system/role', color: 'green' },
  { label: '菜单管理', icon: 'ant-design:menu-outlined', route: '/system/menu', color: 'orange' },
  { label: '字典管理', icon: 'ant-design:book-outlined', route: '/system/dict', color: 'purple' },
  { label: '系统设置', icon: 'ant-design:setting-outlined', route: '/system/settings', color: 'cyan' },
  { label: '操作日志', icon: 'ant-design:file-text-outlined', route: '#', color: 'magenta' },
]

function getActionClassName(color: string) {
  return cn(
    'flex flex-col items-center gap-2 p-4 rounded-xl cursor-pointer transition-all duration-200',
    'hover:scale-105 hover:shadow-md border border-transparent hover:border-gray-200 dark:hover:border-gray-700',
    {
      'hover:bg-blue-50 dark:hover:bg-blue-950/20': color === 'blue',
      'hover:bg-emerald-50 dark:hover:bg-emerald-950/20': color === 'green',
      'hover:bg-orange-50 dark:hover:bg-orange-950/20': color === 'orange',
      'hover:bg-violet-50 dark:hover:bg-violet-950/20': color === 'purple',
      'hover:bg-cyan-50 dark:hover:bg-cyan-950/20': color === 'cyan',
      'hover:bg-pink-50 dark:hover:bg-pink-950/20': color === 'magenta',
    },
  )
}

function getActionIconClass(color: string) {
  const map: Record<string, string> = {
    blue: 'text-blue-500',
    green: 'text-emerald-500',
    orange: 'text-orange-500',
    purple: 'text-violet-500',
    cyan: 'text-cyan-500',
    magenta: 'text-pink-500',
  }
  return cn('text-2xl', map[color] || map.blue)
}

function handleQuickAction(route: string) {
  if (route !== '#') {
    router.push(route)
  }
}

// 最近动态（faker 生成）
interface Activity {
  user: string
  avatar: string
  action: string
  target: string
  time: string
  type: 'user' | 'role' | 'menu' | 'dict' | 'system'
}

/** 动作模板库 — 覆盖用户、角色、菜单、字典、系统五大类操作 */
const actionTemplates: { action: string, targetFn: () => string, type: Activity['type'] }[] = [
  // 用户相关
  { action: '创建了用户', targetFn: () => faker.person.fullName(), type: 'user' },
  { action: '修改了用户信息', targetFn: () => faker.person.fullName(), type: 'user' },
  { action: '删除了用户', targetFn: () => faker.person.fullName(), type: 'user' },
  { action: '重置了密码', targetFn: () => faker.person.fullName(), type: 'user' },
  { action: '启用了账号', targetFn: () => faker.person.fullName(), type: 'user' },
  // 角色相关
  { action: '修改了角色权限', targetFn: () => faker.helpers.arrayElement(['管理员', '运营人员', '编辑者', '访客', '客服']), type: 'role' },
  { action: '新增了角色', targetFn: () => `${faker.company.buzzNoun()}组`, type: 'role' },
  { action: '分配了角色', targetFn: () => `${faker.person.firstName()} → ${faker.helpers.arrayElement(['编辑者', '审核员'])}`, type: 'role' },
  // 菜单相关
  { action: '更新了菜单配置', targetFn: () => faker.helpers.arrayElement(['系统监控', '用户管理', '日志中心', '数据看板', 'API网关']), type: 'menu' },
  { action: '新增了菜单项', targetFn: () => faker.helpers.arrayElement(['API文档', '工单系统', '报表中心', '消息中心']), type: 'menu' },
  { action: '调整了菜单顺序', targetFn: () => faker.helpers.arrayElement(['顶部导航', '侧边栏', '快捷入口']), type: 'menu' },
  // 字典相关
  { action: '新增了字典项', targetFn: () => `${faker.helpers.arrayElement(['订单状态', '支付方式', '物流公司', '商品分类'])} - ${faker.word.sample()}`, type: 'dict' },
  { action: '修改了字典值', targetFn: () => faker.helpers.arrayElement(['性别选项', '学历列表', '行业分类']), type: 'dict' },
  // 系统相关
  { action: '修改了系统参数', targetFn: () => faker.helpers.arrayElement(['站点名称', '文件上传限制', '会话超时时间', '登录验证码']), type: 'system' },
  { action: '执行了数据备份', targetFn: () => `${faker.date.recent().toLocaleDateString('zh-CN')} 全量备份`, type: 'system' },
  { action: '更新了系统版本', targetFn: () => `v${faker.system.semver()}`, type: 'system' },
  { action: '清理了缓存', targetFn: () => faker.helpers.arrayElement(['Redis缓存', 'CDN缓存', '页面缓存']), type: 'system' },
]

/** 时间描述生成 */
function generateTimeAgo(): string {
  const minutes = faker.number.int({ min: 1, max: 180 })
  if (minutes < 60)
    return `${minutes} 分钟前`
  if (minutes < 1440)
    return `${Math.floor(minutes / 60)} 小时前`
  return `${Math.floor(minutes / 1440)} 天前`
}

/** 使用 ref 包装，确保 vue3-seamless-scroll 能检测到数据变化 */
const activities = ref<Activity[]>(
  Array.from({ length: 20 }, (_, i) => {
    const template = actionTemplates[i % actionTemplates.length]
    const userName = faker.person.lastName() + faker.person.firstName()[0]
    return {
      user: userName,
      avatar: userName[0],
      action: template.action,
      target: template.targetFn(),
      time: generateTimeAgo(),
      type: template.type,
    }
  }),
)

function getActivityTypeColor(type: string) {
  const map: Record<string, string> = {
    user: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    role: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    menu: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    dict: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
    system: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
  }
  return map[type] || map.user
}

// 待办事项（faker 生成）
interface TodoItem {
  id: number
  content: string
  priority: 'high' | 'medium' | 'low'
  done: boolean
}

const todoTemplates = [
  () => `审核新注册用户 ${faker.person.fullName()} 的申请资料`,
  () => `更新${faker.helpers.arrayElement(['安全策略文档', '隐私协议条款', '服务使用协议'])}`,
  () => `清理 ${faker.date.recent().getMonth() + 1} 月过期的${faker.helpers.arrayElement(['访问日志', '错误日志', '操作日志'])}`,
  () => `备份 ${faker.helpers.arrayElement(['主数据库', '用户表', '订单表', '配置信息'])} 到备用服务器`,
  () => `检查服务器 ${faker.helpers.arrayElement(['SSL证书有效期', '磁盘剩余空间', '内存占用率', 'CPU负载'])}`,
  () => `处理工单 #${faker.string.numeric(6)}：${faker.lorem.sentence({ min: 4, max: 8 })}`,
  () => `审批${faker.helpers.arrayElement(['员工请假申请', '费用报销单', '采购申请单', '合同签署申请'])}`,
  () => `更新${faker.helpers.arrayElement(['首页Banner图', '公告栏内容', '帮助中心文档', 'FAQ条目'])}`,
  () => `对接${faker.company.name()} 的${faker.helpers.arrayElement(['API接口', '数据同步', 'SSO单点登录'])}`,
  () => `修复线上 Bug：${faker.helpers.arrayElement(['用户登录偶发失败', '文件上传超时', '搜索结果不正确'])}`,
  () => `优化${faker.helpers.arrayElement(['首页加载速度', '查询接口响应', '图片压缩质量'])}`,
  () => `完成 ${faker.date.recent().toLocaleDateString('zh-CN')} 版本发布前的回归测试`,
]

const priorities: TodoItem['priority'][] = ['high', 'medium', 'low']

const todoList = ref<TodoItem[]>(
  Array.from({ length: 15 }, (_, i) => ({
    id: i + 1,
    content: todoTemplates[i % todoTemplates.length](),
    priority: priorities[i % 3],
    done: i % 4 === 0, // 约 25% 概率已完成
  })),
)

function getPriorityTag(priority: string) {
  const map: Record<string, { color: string, label: string }> = {
    high: { color: 'red', label: '紧急' },
    medium: { color: 'orange', label: '普通' },
    low: { color: 'default', label: '低' },
  }
  return map[priority] || map.medium
}

// ═══════════════════════════════════════════
// 📈 数据分析图表数据（原 echarts/index.vue）
// ═══════════════════════════════════════════

// KPI 统计卡片
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

// ECharts 主题工具函数
function textColor() {
  return isDark.value ? '#d1d5db' : '#374151'
}
function subTextColor() {
  return isDark.value ? '#6b7280' : '#9ca3af'
}
function borderColor() {
  return isDark.value ? '#374151' : '#e5e7eb'
}
function axisLineColor() {
  return isDark.value ? '#4b5563' : '#d1d5db'
}
function tooltipBg() {
  return isDark.value ? 'rgba(31,41,55,0.96)' : 'rgba(255,255,255,0.96)'
}

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

// Chart 1: 系统活动趋势（主图）
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

// Chart 2: 流量来源分布
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

// Chart 3: 系统健康仪表盘
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

// Chart 4: 资源使用雷达图
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

// Chart 5: 活动热力图
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

// Chart 6: 用户行为漏斗
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

// Chart 7: 模块使用排行（动态）
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
        data: sorted.map(d => ({
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

// 导出报告
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
        img.onerror = () => {
          offsetY += 300 + chartGap
          checkLast()
        }
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

function initAllCharts() {
  safeInit('mainTrend', mainTrendRef, () => initMainTrend())
  safeInit('trafficDist', trafficDistRef, () => initTrafficDist())
  safeInit('systemHealth', systemHealthRef, () => initSystemHealth())
  safeInit('resourceRadar', resourceRadarRef, () => initResourceRadar())
  safeInit('activityHeatmap', activityHeatmapRef, () => initActivityHeatmap())
  safeInit('userJourney', userJourneyRef, () => initUserJourney())
  safeInit('moduleRank', moduleRankRef, () => initModuleRank())
}

function disposeAll() {
  charts.forEach(c => c.dispose())
  charts.clear()
}

useEventListener(window, 'resize', () => charts.forEach(c => c.resize()))

onMounted(() => {
  nextTick(() => initAllCharts())
})

// 切换到数据分析 Tab 时重新初始化图表（解决隐藏容器导致宽度为0的问题）
watch(activeTab, (val) => {
  if (val === 'analytics') {
    // 先销毁旧实例，等 DOM 渲染后再重新创建
    disposeAll()
    nextTick(() => {
      setTimeout(() => initAllCharts(), 100)
    })
  }
})
onBeforeUnmount(disposeAll)
</script>

<template>
  <div :class="containerClassName">
    <!-- 页面标题 -->
    <div class="flex items-center justify-between mb-2">
      <div>
        <h1 class="text-2xl font-bold text-gray-800 dark:text-white">
          数据看板
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          系统运行状态与数据分析
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
          v-if="activeTab === 'analytics'"
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

    <!-- Tab 切换 -->
    <a-tabs
      v-model:active-key="activeTab"
      size="large"
    >
      <!-- Tab 1: 总览仪表盘 -->
      <a-tab-pane
        key="overview"
        tab="总览"
      >
        <div :class="overviewContainerClassName">
          <!-- 欢迎区域 -->
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-2xl font-bold text-gray-800 dark:text-white">
                欢迎回来 👋
              </h1>
              <p class="text-gray-500 dark:text-gray-400 mt-1">
                今天是 {{ new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }}
              </p>
            </div>
            <div class="hidden sm:flex items-center gap-3">
              <a-button @click="router.push('/system/user')">
                <template #icon>
                  <Icon icon="ant-design:user-add-outlined" />
                </template>
                新增用户
              </a-button>
              <a-button
                type="primary"
                @click="router.push('/system/settings')"
              >
                <template #icon>
                  <Icon icon="ant-design:setting-outlined" />
                </template>
                系统设置
              </a-button>
            </div>
          </div>

          <!-- 统计卡片 -->
          <a-row
            :gutter="[16,
                      16]"
          >
            <a-col
              v-for="stat in statCards"
              :key="stat.title"
              :xs="12"
              :sm="12"
              :lg="6"
            >
              <div
                :class="cn(
                  'rounded-xl p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5',
                  getStatCardBg(stat.color),
                )"
              >
                <div class="flex items-start justify-between">
                  <div>
                    <p class="text-sm text-gray-500 dark:text-gray-400 font-medium">
                      {{ stat.title }}
                    </p>
                    <p class="text-3xl font-bold mt-2 text-gray-800 dark:text-white tracking-tight">
                      {{ stat.value }}
                    </p>
                    <div class="flex items-center gap-1 mt-2">
                      <Icon
                        :icon="stat.trend >= 0 ? 'carbon:arrow-up' : 'carbon:arrow-down'"
                        :width="14"
                        :height="14"
                        :class="stat.trend >= 0 ? 'text-emerald-500' : 'text-red-500'"
                      />
                      <span
                        :class="cn(
                          'text-sm font-medium',
                          stat.trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                        )"
                      >
                        {{ Math.abs(stat.trend) }}%
                      </span>
                      <span class="text-xs text-gray-400">{{ stat.trendLabel }}</span>
                    </div>
                  </div>
                  <div
                    :class="cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
                      getStatIconBg(stat.color),
                    )"
                  >
                    <Icon
                      :icon="stat.icon"
                      :width="24"
                      :height="24"
                    />
                  </div>
                </div>
              </div>
            </a-col>
          </a-row>

          <!-- 图表 + 快捷操作 -->
          <a-row
            :gutter="[16,
                      16]"
            align="stretch"
          >
            <!-- 访问趋势 -->
            <a-col
              :xs="24"
              :lg="16"
            >
              <a-card
                title="访问趋势"
                variant="borderless"
                class-name="rounded-xl border border-gray-100 dark:border-gray-800 h-full"
              >
                <template #extra>
                  <span class="text-sm text-gray-400">近 7 天</span>
                </template>
                <div class="relative">
                  <svg
                    :viewBox="`0 0 ${chart.width} ${chart.height}`"
                    class="w-full"
                    preserveAspectRatio="none"
                    style="height: 220px;"
                  >
                    <!-- 网格线 -->
                    <line
                      v-for="i in 4"
                      :key="`grid-${i}`"
                      :x1="chart.padding.left"
                      :y1="chart.padding.top + ((chart.chartH / 4)) * i - (chart.padding.top * 0)"
                      :x2="chart.width - chart.padding.right"
                      :y2="chart.padding.top + ((chart.chartH / 4)) * i - (chart.padding.top * 0)"
                      stroke="#f0f0f0"
                      stroke-dasharray="4,4"
                      class="dark:stroke-gray-700"
                    />

                    <!-- 渐变定义 -->
                    <defs>
                      <linearGradient
                        id="areaGradient"
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop
                          offset="0%"
                          stop-color="#1677ff"
                          stop-opacity="0.3"
                        />
                        <stop
                          offset="100%"
                          stop-color="#1677ff"
                          stop-opacity="0.02"
                        />
                      </linearGradient>
                    </defs>

                    <!-- 面积填充 -->
                    <path
                      :d="chart.areaPath"
                      fill="url(#areaGradient)"
                    />

                    <!-- 折线 -->
                    <path
                      :d="chart.linePath"
                      fill="none"
                      stroke="#1677ff"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />

                    <!-- 数据点 -->
                    <circle
                      v-for="(point, idx) in chart.points"
                      :key="`dot-${idx}`"
                      :cx="point.x"
                      :cy="point.y"
                      r="4"
                      fill="#fff"
                      stroke="#1677ff"
                      stroke-width="2.5"
                    />

                    <!-- X 轴标签 -->
                    <text
                      v-for="(d, idx) in chartData"
                      :key="`label-${idx}`"
                      :x="chart.padding.left + (idx * ((chart.width - chart.padding.left - chart.padding.right) / (chartData.length - 1)))"
                      :y="chart.height - 8"
                      text-anchor="middle"
                      class="fill-gray-400 dark:fill-gray-500"
                      font-size="12"
                    >
                      {{ d.day }}
                    </text>
                  </svg>
                </div>
              </a-card>
            </a-col>

            <!-- 快捷操作 -->
            <a-col
              :xs="24"
              :lg="8"
            >
              <a-card
                title="快捷操作"
                variant="borderless"
                class-name="rounded-xl border border-gray-100 dark:border-gray-800 h-full"
              >
                <div class="grid grid-cols-3 gap-3 py-2">
                  <div
                    v-for="action in quickActions"
                    :key="action.label"
                    :class="getActionClassName(action.color)"
                    @click="handleQuickAction(action.route)"
                  >
                    <Icon
                      :icon="action.icon"
                      :class="getActionIconClass(action.color)"
                    />
                    <span class="text-xs text-gray-600 dark:text-gray-400 font-medium">{{ action.label }}</span>
                  </div>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <!-- 待办事项 + 最近动态 -->
          <a-row
            :gutter="[16,
                      16]"
            align="stretch"
          >
            <!-- 待办事项 -->
            <a-col
              :xs="24"
              :lg="10"
            >
              <a-card
                title="待办事项"
                variant="borderless"
                class-name="rounded-xl border border-gray-100 dark:border-gray-800 h-full"
              >
                <template #extra>
                  <a-badge
                    :count="todoList.filter(t => !t.done).length"
                    :offset="[0,
                              0]"
                  >
                    <span class="text-sm text-gray-400">进行中</span>
                  </a-badge>
                </template>
                <PerfectScrollbar
                  :options="scrollbarOptions"
                  :class="panelScrollHeight"
                >
                  <div class="space-y-3 p-1">
                    <div
                      v-for="data in todoList"
                      :key="data.id"
                      :class="cn(
                        'flex items-start gap-3 p-3 rounded-lg transition-colors',
                        data.done ? 'bg-gray-50 dark:bg-gray-900/30' : 'bg-white dark:bg-gray-900/20 border border-gray-100 dark:border-gray-800',
                      )"
                    >
                      <a-checkbox
                        :checked="data.done"
                        class="mt-0.5"
                      />
                      <div class="flex-1 min-w-0">
                        <p
                          :class="cn(
                            'text-sm',
                            data.done ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300',
                          )"
                        >
                          {{ data.content }}
                        </p>
                      </div>
                      <a-tag
                        :color="getPriorityTag(data.priority).color"
                        size="small"
                      >
                        {{ getPriorityTag(data.priority).label }}
                      </a-tag>
                    </div>
                  </div>
                </PerfectScrollbar>
              </a-card>
            </a-col>

            <!-- 最近动态 -->
            <a-col
              :xs="24"
              :lg="14"
            >
              <a-card
                title="最近动态"
                variant="borderless"
                class-name="rounded-xl border border-gray-100 dark:border-gray-800 h-full"
              >
                <template #extra>
                  <a-button
                    type="link"
                    size="small"
                  >
                    查看全部
                  </a-button>
                </template>
                <PerfectScrollbar
                  :options="scrollbarOptions"
                  :class="panelScrollHeight"
                >
                  <a-timeline
                    mode="left"
                    class="mt-2 p-1"
                  >
                    <a-timeline-item
                      v-for="(data, index) in activities"
                      :key="index"
                      :color="index === 0 ? '#1677ff' : undefined"
                    >
                      <div class="flex items-center gap-2 flex-wrap">
                        <a-avatar
                          :size="28"
                          :class="getActivityTypeColor(data.type)"
                        >
                          {{ data.avatar }}
                        </a-avatar>
                        <span class="font-medium text-gray-800 dark:text-gray-200 text-sm">{{ data.user }}</span>
                        <span class="text-gray-500 text-sm">{{ data.action }}</span>
                        <a-tag
                          color="blue"
                          size="small"
                        >
                          {{ data.target }}
                        </a-tag>
                        <span class="text-gray-400 text-xs ml-auto">{{ data.time }}</span>
                      </div>
                    </a-timeline-item>
                  </a-timeline>
                </PerfectScrollbar>
              </a-card>
            </a-col>
          </a-row>

          <!-- 系统信息 -->
          <a-card
            title="系统概览"
            variant="borderless"
            class-name="rounded-xl border border-gray-100 dark:border-gray-800"
          >
            <a-row :gutter="24">
              <a-col
                :xs="12"
                :sm="6"
              >
                <div class="text-center p-4">
                  <p class="text-2xl font-bold text-primary">
                    v1.0.0
                  </p>
                  <p class="text-sm text-gray-500 mt-1">
                    系统版本
                  </p>
                </div>
              </a-col>
              <a-col
                :xs="12"
                :sm="6"
              >
                <div class="text-center p-4">
                  <p class="text-2xl font-bold text-gray-800 dark:text-white">
                    Vue 3.5
                  </p>
                  <p class="text-sm text-gray-500 mt-1">
                    前端框架
                  </p>
                </div>
              </a-col>
              <a-col
                :xs="12"
                :sm="6"
              >
                <div class="text-center p-4">
                  <p class="text-2xl font-bold text-gray-800 dark:text-white">
                    Antdv Next
                  </p>
                  <p class="text-sm text-gray-500 mt-1">
                    UI 组件库
                  </p>
                </div>
              </a-col>
              <a-col
                :xs="12"
                :sm="6"
              >
                <div class="text-center p-4">
                  <p class="text-2xl font-bold text-gray-800 dark:text-white">
                    {{ appStore.themeStyle || 'light' }}
                  </p>
                  <p class="text-sm text-gray-500 mt-1">
                    当前主题
                  </p>
                </div>
              </a-col>
            </a-row>
          </a-card>
        </div>
      </a-tab-pane>

      <!-- Tab 2: 数据分析 -->
      <a-tab-pane
        key="analytics"
        tab="数据分析"
      >
        <div class="space-y-8">
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
            :class="analyticsCardClassName"
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
                :class="analyticsCardClassName"
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
                :class="analyticsCardClassName"
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
                :class="analyticsCardClassName"
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
                :class="analyticsCardClassName"
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
                :class="cn(analyticsCardClassName, 'h-full')"
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
                :class="cn(analyticsCardClassName, 'h-full')"
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
      </a-tab-pane>
    </a-tabs>
  </div>
</template>
