<script setup lang="tsx">
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getWorkbenchSummary } from '@/api/system'
import { useUserStore } from '@/stores/modules/user'
import dayjs from 'dayjs'
import { getTimeGreeting } from '@/utils'

defineOptions({ name: 'Workbench' })

const router = useRouter()
const userStore = useUserStore()

const data = ref<any>({
  stats: {
    userCount: 0,
    roleCount: 0,
    deptCount: 0,
    noticeCount: 0,
    unreadNotice: 0,
    todoUncompleted: 0,
    todoOverdue: 0,
  },
  loginTrend: [],
  recentLogs: [],
})

// ============ 欢迎卡片的动态问候语 ============
const greeting = getTimeGreeting()
const todayLabel = computed(() => dayjs().format('YYYY年MM月DD日'))

const weekLabel = computed(() => {
  const week = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return week[dayjs().day()]
})

// ============ 统计卡片 ============
const statCards = computed(() => [
  {
    title: '用户总数',
    value: data.value.stats?.userCount || 0,
    suffix: '人',
    icon: 'carbon:user-multiple',
    color: '#2563eb',
    path: '/system/user',
  },
  {
    title: '角色数量',
    value: data.value.stats?.roleCount || 0,
    suffix: '个',
    icon: 'carbon:user-role',
    color: '#7c3aed',
    path: '/system/role',
  },
  {
    title: '部门数量',
    value: data.value.stats?.deptCount || 0,
    suffix: '个',
    icon: 'carbon:tree-view',
    color: '#059669',
    path: '/system/dept',
  },
  {
    title: '未读消息',
    value: data.value.stats?.unreadNotice || 0,
    suffix: '条',
    icon: 'carbon:notification',
    color: '#d97706',
    path: '/message/my',
  },
])

// ============ 快捷入口 ============
const shortcuts = [
  { title: '用户管理', icon: 'carbon:user-multiple', path: '/system/user', color: '#2563eb' },
  { title: '角色管理', icon: 'carbon:user-role', path: '/system/role', color: '#7c3aed' },
  { title: '菜单配置', icon: 'carbon:menu', path: '/system/menu', color: '#059669' },
  { title: '部门管理', icon: 'carbon:tree-view', path: '/system/dept', color: '#d97706' },
  {
    title: '权限管理',
    icon: 'carbon:shield-checkmark',
    path: '/system/permission',
    color: '#0891b2',
  },
  { title: '系统配置', icon: 'carbon:settings', path: '/system/config', color: '#db2777' },
  { title: '通知公告', icon: 'carbon:notification', path: '/system/notice', color: '#dc2626' },
  { title: '数据字典', icon: 'carbon:book', path: '/system/dict', color: '#4f46e5' },
]

async function load() {
  const res = await getWorkbenchSummary()
  data.value = res?.data ?? res ?? data.value
}

function navigate(path: string) {
  router.push(path)
}

// ============ Listy 渲染最近操作 ============
interface LogItem {
  log_id: string
  username: string
  operation: string
  status: string
  created_at: string
}

const recentLogs = computed<LogItem[]>(() => data.value.recentLogs || [])

const renderLogItem = (item: LogItem) => (
  <div class="group flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors">
    <span
      class="inline-flex items-center justify-center w-14 h-5 rounded text-[11px] font-medium flex-shrink-0"
      style={{
        backgroundColor: item.status === '1' ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.08)',
        color: item.status === '1' ? '#059669' : '#dc2626',
      }}
    >
      {item.status === '1' ? '成功' : '失败'}
    </span>
    <span class="text-[13px] font-medium text-gray-700 dark:text-gray-200 w-24 truncate flex-shrink-0">
      {item.username || '-'}
    </span>
    <span class="text-[13px] text-gray-500 dark:text-gray-400 flex-1 truncate">
      {item.operation}
    </span>
    <span class="text-xs text-gray-400 tabular-nums flex-shrink-0">
      {dayjs(item.created_at).format('MM-DD HH:mm:ss')}
    </span>
  </div>
)

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <!-- ==================== 欢迎卡片（自然风） ==================== -->
    <div
      class="relative rounded-xl border border-gray-200/70 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden"
    >
      <!-- 左侧细强调线 -->
      <div
        class="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-slate-700 via-slate-500 to-slate-300 dark:from-slate-400 dark:via-slate-600 dark:to-slate-800"
      />

      <div class="relative flex items-center gap-5 px-6 py-5">
        <div class="relative">
          <a-avatar
            :size="64"
            :src="userStore.avatar"
            class="ring-2 ring-gray-100 dark:ring-gray-800 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            {{ userStore.username?.charAt(0)?.toUpperCase() || 'U' }}
          </a-avatar>
          <span
            class="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-gray-900"
          />
        </div>

        <div class="flex-1 min-w-0">
          <h1 class="text-xl font-semibold text-gray-800 dark:text-gray-100 tracking-tight">
            {{ greeting }}，{{ userStore.username || '用户' }}
          </h1>
          <div class="mt-1.5 flex items-center gap-4 text-[13px] text-gray-500 dark:text-gray-400">
            <span class="inline-flex items-center gap-1.5">
              <Icon icon="carbon:calendar" class="text-gray-400" />
              {{ todayLabel }} · {{ weekLabel }}
            </span>
            <span class="inline-flex items-center gap-1.5">
              <Icon icon="carbon:user-role" class="text-gray-400" />
              {{ userStore.roles?.join('、') || '未分配角色' }}
            </span>
          </div>
        </div>

        <!-- 右侧小数据 -->
        <div class="hidden md:flex items-center gap-6 pr-1">
          <div class="text-right">
            <div
              class="text-xl font-semibold text-gray-800 dark:text-gray-100 tabular-nums leading-none"
            >
              {{ data.stats?.todoUncompleted || 0 }}
            </div>
            <div class="text-[11px] text-gray-400 mt-1.5">待处理</div>
          </div>
          <div class="w-px h-8 bg-gray-200 dark:bg-gray-700" />
          <div class="text-right">
            <div
              class="text-xl font-semibold text-gray-800 dark:text-gray-100 tabular-nums leading-none"
            >
              {{ data.stats?.unreadNotice || 0 }}
            </div>
            <div class="text-[11px] text-gray-400 mt-1.5">未读</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== 统计卡片 ==================== -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div
        v-for="card in statCards"
        :key="card.title"
        class="group relative rounded-xl border border-gray-200/70 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-4 cursor-pointer transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm"
        @click="navigate(card.path)"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-xs text-gray-400 dark:text-gray-500">{{ card.title }}</div>
            <div class="mt-2 flex items-baseline gap-1">
              <span
                class="text-2xl font-semibold tracking-tight text-gray-800 dark:text-gray-100 tabular-nums"
              >
                {{ card.value }}
              </span>
              <span class="text-xs text-gray-400">{{ card.suffix }}</span>
            </div>
          </div>
          <div
            class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105"
            :style="{ backgroundColor: `${card.color}10`, color: card.color }"
          >
            <Icon :icon="card.icon" class="text-xl" />
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== 快捷入口 + 待办 ==================== -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <a-card :bordered="false" class="shadow-sm lg:col-span-2 rounded-xl">
        <template #title>
          <div class="flex items-center gap-2 text-[14px] font-medium">
            <Icon icon="carbon:apps" class="text-gray-500" />
            <span>快捷入口</span>
          </div>
        </template>
        <div class="grid grid-cols-4 gap-2">
          <div
            v-for="s in shortcuts"
            :key="s.path"
            class="group flex flex-col items-center gap-2 py-3 rounded-lg cursor-pointer transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800/60"
            @click="navigate(s.path)"
          >
            <div
              class="w-11 h-11 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
              :style="{ backgroundColor: `${s.color}10`, color: s.color }"
            >
              <Icon :icon="s.icon" class="text-xl" />
            </div>
            <span class="text-xs text-gray-600 dark:text-gray-400">{{ s.title }}</span>
          </div>
        </div>
      </a-card>

      <a-card :bordered="false" class="shadow-sm rounded-xl">
        <template #title>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-[14px] font-medium">
              <Icon icon="carbon:task" class="text-gray-500" />
              <span>我的待办</span>
            </div>
            <a-button type="link" size="small" class="!px-1" @click="navigate('/message/todo')">
              更多
              <Icon icon="carbon:chevron-right" class="text-xs" />
            </a-button>
          </div>
        </template>

        <div class="space-y-3">
          <div
            class="flex items-center justify-between p-3 rounded-lg bg-blue-50/60 dark:bg-blue-900/10"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center text-white"
              >
                <Icon icon="carbon:list-checked" class="text-lg" />
              </div>
              <div>
                <div class="text-xs text-gray-500">进行中</div>
                <div
                  class="text-lg font-semibold text-gray-800 dark:text-white leading-none mt-0.5 tabular-nums"
                >
                  {{ data.stats?.todoUncompleted || 0 }}
                  <span class="text-xs font-normal text-gray-400">项</span>
                </div>
              </div>
            </div>
          </div>

          <div
            class="flex items-center justify-between p-3 rounded-lg bg-red-50/60 dark:bg-red-900/10"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-9 h-9 rounded-lg bg-red-500 flex items-center justify-center text-white"
              >
                <Icon icon="carbon:warning-alt" class="text-lg" />
              </div>
              <div>
                <div class="text-xs text-gray-500">已逾期</div>
                <div
                  class="text-lg font-semibold text-gray-800 dark:text-white leading-none mt-0.5 tabular-nums"
                >
                  {{ data.stats?.todoOverdue || 0 }}
                  <span class="text-xs font-normal text-gray-400">项</span>
                </div>
              </div>
            </div>
          </div>

          <a-button type="primary" block @click="navigate('/message/todo')">
            <template #icon><Icon icon="carbon:arrow-right" /></template>
            查看全部待办
          </a-button>
        </div>
      </a-card>
    </div>

    <!-- ==================== 最近操作（Listy 虚拟列表） ==================== -->
    <a-card :bordered="false" class="shadow-sm rounded-xl">
      <template #title>
        <div class="flex items-center gap-2 text-[14px] font-medium">
          <Icon icon="carbon:time" class="text-gray-500" />
          <span>最近操作</span>
          <span class="text-xs font-normal text-gray-400 ml-1">（{{ recentLogs.length }} 条）</span>
        </div>
      </template>

      <div v-if="recentLogs.length === 0" class="py-12 text-center text-gray-400">
        <Icon icon="carbon:document" class="text-4xl opacity-30 mb-2" />
        <div class="text-sm">暂无操作记录</div>
      </div>

      <a-listy
        v-else
        :items="recentLogs"
        :row-key="(item: LogItem) => item.log_id"
        :height="360"
        :item-render="renderLogItem"
      />
    </a-card>
  </div>
</template>
