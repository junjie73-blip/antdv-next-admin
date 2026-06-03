<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/modules/app'
import { cn } from '@/utils/cn'

const router = useRouter()
const appStore = useAppStore()

const containerClassName = computed(() =>
  cn('p-6 space-y-6'),
)

// ========== 统计卡片数据 ==========
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
    value: '2,847',
    icon: 'carbon:view',
    trend: 12.5,
    trendLabel: '较昨日',
    color: 'blue',
  },
  {
    title: '在线用户',
    value: '186',
    icon: 'carbon:user-multiple',
    trend: -3.2,
    trendLabel: '较昨日',
    color: 'green',
  },
  {
    title: '消息通知',
    value: '24',
    icon: 'carbon:notification',
    trend: 8.0,
    trendLabel: '较上周',
    color: 'orange',
  },
  {
    title: '待办事项',
    value: '13',
    icon: 'carbon:task',
    trend: -15.0,
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

// ========== 访问趋势图数据（近7天） ==========
const chartData = [
  { day: '周一', value: 1200 },
  { day: '周二', value: 1900 },
  { day: '周三', value: 1650 },
  { day: '周二', value: 2300 },
  { day: '周五', value: 2100 },
  { day: '周六', value: 1400 },
  { day: '周日', value: 2847 },
]

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

  // 面积路径：从左下角开始 → 各点连线 → 右下角闭合
  let areaPath = `M ${padding.left} ${padding.top + chartH}`
  points.forEach((p) => { areaPath += ` L ${p.x} ${p.y}` })
  areaPath += ` L ${points[points.length - 1].x} ${padding.top + chartH} Z`

  // 折线路径
  let linePath = `M ${points[0].x} ${points[0].y}`
  points.slice(1).forEach((p) => { linePath += ` L ${p.x} ${p.y}` })

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

// ========== 最近动态 ==========
interface Activity {
  user: string
  avatar: string
  action: string
  target: string
  time: string
  type: 'user' | 'role' | 'menu' | 'dict' | 'system'
}

const activities: Activity[] = [
  { user: '管理员', avatar: 'A', action: '创建了用户', target: '张三 (zhangsan)', time: '2 分钟前', type: 'user' },
  { user: '管理员', avatar: 'A', action: '修改了角色', target: '运营人员', time: '8 分钟前', type: 'role' },
  { user: '张三', avatar: 'Z', action: '更新了菜单', target: '系统监控', time: '15 分钟前', type: 'menu' },
  { user: '李四', avatar: 'L', action: '新增了字典项', target: '订单状态', time: '30 分钟前', type: 'dict' },
  { user: '王五', avatar: 'W', action: '修改了配置', target: '站点名称', time: '1 小时前', type: 'system' },
  { user: '赵六', avatar: 'Z', action: '删除了用户', target: '已离职员工', time: '2 小时前', type: 'user' },
]

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

// ========== 待办事项 ==========
interface TodoItem {
  id: number
  content: string
  priority: 'high' | 'medium' | 'low'
  done: boolean
}

const todoList = ref<TodoItem[]>([
  { id: 1, content: '审核新注册用户申请 (3 条待审)', priority: 'high', done: false },
  { id: 2, content: '更新系统安全策略文档', priority: 'medium', done: false },
  { id: 3, content: '清理过期日志文件', priority: 'low', done: true },
  { id: 4, content: '备份本季度数据库', priority: 'high', done: false },
  { id: 5, content: '检查服务器 SSL 证书有效期', priority: 'medium', done: false },
])

function getPriorityTag(priority: string) {
  const map: Record<string, { color: string, label: string }> = {
    high: { color: 'red', label: '紧急' },
    medium: { color: 'orange', label: '普通' },
    low: { color: 'default', label: '低' },
  }
  return map[priority] || map.medium
}
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

    <!-- 图表 + 待办 -->
    <a-row
      :gutter="[16,
                16]"
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

      <!-- 待办事项 -->
      <a-col
        :xs="24"
        :lg="8"
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
          <div class="space-y-3">
            <div
              v-for="todo in todoList"
              :key="todo.id"
              :class="cn(
                'flex items-start gap-3 p-3 rounded-lg transition-colors',
                todo.done ? 'bg-gray-50 dark:bg-gray-900/30' : 'bg-white dark:bg-gray-900/20 border border-gray-100 dark:border-gray-800',
              )"
            >
              <a-checkbox
                :checked="todo.done"
                class="mt-0.5"
              />
              <div class="flex-1 min-w-0">
                <p
                  :class="cn(
                    'text-sm',
                    todo.done ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300',
                  )"
                >
                  {{ todo.content }}
                </p>
              </div>
              <a-tag
                :color="getPriorityTag(todo.priority).color"
                size="small"
              >
                {{ getPriorityTag(todo.priority).label }}
              </a-tag>
            </div>
          </div>
        </a-card>
      </a-col>
    </a-row>

    <!-- 快捷操作 + 最近动态 -->
    <a-row
      :gutter="[16,
                16]"
    >
      <!-- 快捷操作 -->
      <a-col
        :xs="24"
        :lg="10"
      >
        <a-card
          title="快捷操作"
          variant="borderless"
          class-name="rounded-xl border border-gray-100 dark:border-gray-800 h-full"
        >
          <div class="grid grid-cols-3 gap-3">
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
          <a-timeline
            mode="left"
            class="mt-2"
          >
            <a-timeline-item
              v-for="(activity, index) in activities"
              :key="index"
              :color="index === 0 ? '#1677ff' : undefined"
            >
              <div class="flex items-center gap-2 flex-wrap">
                <a-avatar
                  :size="28"
                  :class="getActivityTypeColor(activity.type)"
                >
                  {{ activity.avatar }}
                </a-avatar>
                <span class="font-medium text-gray-800 dark:text-gray-200 text-sm">{{ activity.user }}</span>
                <span class="text-gray-500 text-sm">{{ activity.action }}</span>
                <a-tag
                  color="blue"
                  size="small"
                >
                  {{ activity.target }}
                </a-tag>
                <span class="text-gray-400 text-xs ml-auto">{{ activity.time }}</span>
              </div>
            </a-timeline-item>
          </a-timeline>
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
