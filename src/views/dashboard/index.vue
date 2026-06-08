<script setup lang="ts">
import { faker } from '@faker-js/faker/locale/zh_CN'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/modules/app'
import { cn } from '@/utils/cn'

// 设置中文 locale 并固定种子，保证每次刷新数据一致但真实
faker.seed(42)

const router = useRouter()
const appStore = useAppStore()

const containerClassName = computed(() =>
  cn('p-6 space-y-6'),
)

// ========== 统计卡片数据（faker 生成） ==========
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

// ========== 访问趋势图数据（近7天，faker 生成） ==========
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

// ========== 快捷操作 ==========
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

// ========== 最近动态（faker 生成） ==========
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

// ========== 待办事项（faker 生成） ==========
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

// ========== 样式变量（遵循项目规范：cn 在 script setup 中定义）==========
/** PerfectScrollbar 统一配置：禁用横向滚动 + 启用滚轮传播 */
const scrollbarOptions = { wheelPropagation: true, suppressScrollX: true }

/** 两个面板统一固定高度，确保底部对齐 */
const panelScrollHeight = cn('h-[380px]')
</script>

<template>
  <div :class="containerClassName">
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
</template>
