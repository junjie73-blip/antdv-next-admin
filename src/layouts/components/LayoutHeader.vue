<script setup lang="tsx">
import type { BreadcrumbProps, MenuProps } from 'antdv-next'

import { Icon } from '@iconify/vue'
import { Badge, Dropdown, Menu, Modal, notification, Popover } from 'antdv-next'
import dayjs from 'dayjs'
import { computed, h, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useLocale } from '@/composables/web/useLocale'
import { useThemeTransition } from '@/composables/web/useThemeTransition'
import { useAppStore } from '@/stores/modules/app'
import { useRouteStore } from '@/stores/modules/route'
import { useUserStore } from '@/stores/modules/user'
import { cn } from '@/utils/cn'
import { useBreadcrumb, useFullscreen } from '../composables/useLayout'
import AccountDrawer from './AccountDrawer.vue'
import SettingDrawer from './SettingDrawer.vue'
import { http } from '@/utils'
import { useWebSocket } from '@vueuse/core'
const _props = defineProps<{
  collapsed?: boolean
  horizontal?: boolean
  mixed?: boolean
  activeTopMenu?: string
}>()

const emit = defineEmits<{
  toggleCollapsed: []
  topMenuSelect: [key: string]
}>()

defineOptions({
  name: 'LayoutHeader',
})

const router = useRouter()
const appStore = useAppStore()
const userStore = useUserStore()
const routeStore = useRouteStore()
const { breadcrumbs } = useBreadcrumb()
const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()
const { toggleThemeWithAnimation } = useThemeTransition()
const { setLocale } = useLocale()

const showAllNotificationsModal = ref(false)
const showSetting = ref(false)
const showNotification = ref(false)
const accountDrawerRef = ref<InstanceType<typeof AccountDrawer> | null>(null)
const appTitle = import.meta.env.VITE_APP_TITLE || 'Antdv Next Admin'

// ========== 通知数据类型 ==========
interface NotificationItem {
  noticeId: string
  title: string
  content: string
  noticeType: number // 1-通知，2-公告，3-提醒
  status: string // '0'-草稿 '1'-发布
  publishTime?: string
  createdAt: string
  isRead: 0 | 1
}

const notifications = ref<NotificationItem[]>([])

const allNotifications = ref<NotificationItem[]>([]) // 全部通知弹窗数据
const unreadCount = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const totalNotifications = ref(0)
const loadingAll = ref(false)

// 通知类型映射
const noticeTypeConfig: Record<
  number,
  { label: string; icon: string; color: string; gradient: string }
> = {
  1: {
    label: '通知',
    icon: 'carbon:notification',
    color: 'blue',
    gradient: 'from-blue-500 to-cyan-500',
  },
  2: {
    label: '公告',
    icon: 'carbon:megaphone',
    color: 'green',
    gradient: 'from-green-500 to-emerald-500',
  },
  3: {
    label: '提醒',
    icon: 'carbon:task',
    color: 'orange',
    gradient: 'from-amber-500 to-yellow-500',
  },
}
// ========== 获取通知列表（头部小弹窗） ==========
async function fetchRecentNotifications() {
  try {
    const { data } = await http
      .Get('/notice/my', { params: { pageNum: 1, pageSize: 10 } })
      .send(true)
    console.log(data, 'data')
    if (data && data.list) {
      notifications.value = data.list.map(transformNotice)
      console.log(notifications.value, 'notifications.value')
      unreadCount.value = data.list.filter((n: any) => n.isRead === false || n.isRead === 0).length
    }
  } catch (e) {
    console.warn('获取通知失败:', e)
  }
}

// 转换通知数据为前端格式
function transformNotice(item: any): NotificationItem {
  return {
    noticeId: item.noticeId,
    title: item.title,
    content: item.content || '',
    noticeType: item.noticeType,
    status: item.status,
    publishTime: item.publishTime || item.publish_time || null, // 兼容
    createdAt: item.createdAt || item.created_at,
    isRead: item.isRead ?? item.is_read ?? false, // 兼容
  }
}
async function fetchAllNotifications(page = 1) {
  loadingAll.value = true
  try {
    const res = await http
      .Get('/notice/my', { params: { pageNum: page, pageSize: pageSize.value } })
      .send(true)
    const data = res?.data ?? res
    if (data) {
      allNotifications.value = data.list.map(transformNotice)
      totalNotifications.value = data.total || 0
      currentPage.value = page
    }
  } catch (e) {
    console.warn('获取全部通知失败:', e)
  } finally {
    loadingAll.value = false
  }
}

function handleViewAllNotifications() {
  router.push('/message/my')
}

function handleAllPageChange(page: number) {
  fetchAllNotifications(page)
}

async function markAsRead(noticeId: string) {
  try {
    await http.Put(`/notice/${noticeId}/read`)
    // 更新本地状态
    notifications.value = notifications.value.map((n) =>
      n.noticeId === noticeId ? { ...n, isRead: 1 } : n,
    )
    allNotifications.value = allNotifications.value.map((n) =>
      n.noticeId === noticeId ? { ...n, isRead: 1 } : n,
    )
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  } catch (e) {
    console.warn('标记已读失败:', e)
  }
}

async function markAllRead() {
  try {
    await http.Put('/notice/read-all')
    notifications.value.forEach((n) => (n.isRead = 1))
    allNotifications.value.forEach((n) => (n.isRead = 1))
    unreadCount.value = 0
  } catch (e) {
    console.warn('全部已读失败:', e)
  }
}

const isGeekStyle = computed(() => appStore.themeStyle === 'geek')
const isDarkMode = computed(() => appStore.themeMode === 'dark' || isGeekStyle.value)

const headerClassName = computed(() =>
  cn(
    'h-14 px-6 flex items-center justify-between',
    'border-b shadow-sm flex-shrink-0',
    isGeekStyle.value
      ? 'bg-[#0a0a0a] border-[#1a1a1a] text-[#00ff88]'
      : isDarkMode.value
        ? 'bg-gray-800 border-gray-700 text-white'
        : 'bg-white border-gray-200 text-gray-800',
  ),
)

const breadcrumbItems = computed<BreadcrumbProps['items']>(() => {
  return breadcrumbs.value.map((item) => ({
    title: item.title,
    path: item.path,
  }))
})

const horizontalMenuItems: MenuProps['items'] = computed(() => {
  const isHorizontal = appStore.layout === 'horizontal'
  return (routeStore.menus || []).map((menu) => ({
    key: menu.path,
    icon: () => h(Icon, { icon: menu.icon || 'carbon:folder', class: 'text-lg' }),
    label: menu.title,
    children:
      isHorizontal && menu.children?.length
        ? menu.children.map((child) => ({
            key: `${menu.path}/${child.path}`,
            label: child.title,
          }))
        : undefined,
  }))
})

const userDropdownItems: MenuProps['items'] = [
  {
    key: 'profile',
    label: '个人中心',
    icon: () => h(Icon, { icon: 'carbon:user-avatar' }),
  },
  {
    key: 'docs',
    label: '文档中心',
    icon: () => h(Icon, { icon: 'carbon:book' }),
  },
  { type: 'divider' },
  {
    key: 'logout',
    label: '退出登录',
    icon: () => h(Icon, { icon: 'carbon:logout' }),
    danger: true,
  },
]

const actionBtnClassName = computed(() =>
  cn(
    'flex items-center justify-center',
    'w-9 h-9 rounded-md',
    'cursor-pointer',
    'transition-colors duration-200',
    isGeekStyle.value
      ? 'text-gray-500 hover:text-[#00ff88] hover:bg-[#1a1a1a]'
      : isDarkMode.value
        ? 'text-gray-400 hover:text-white hover:bg-gray-700'
        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
  ),
)

const notificationIconBgConfig = computed<Record<string, string>>(() => ({
  info: isGeekStyle.value
    ? 'bg-[#0a2a1a] text-[#00ff88]'
    : 'bg-blue-50 text-blue-500 dark:bg-blue-900/30 dark:text-blue-400',
  success: isGeekStyle.value
    ? 'bg-[#0a2a1a] text-[#00ff88]'
    : 'bg-green-50 text-green-500 dark:bg-green-900/30 dark:text-green-400',
  warning: isGeekStyle.value
    ? 'bg-[#2a2a0a] text-[#ffcc00]'
    : 'bg-yellow-50 text-yellow-500 dark:bg-yellow-900/30 dark:text-yellow-400',
  error: isGeekStyle.value
    ? 'bg-[#2a0a0a] text-[#ff4444]'
    : 'bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400',
}))

function notificationItemClassName(read: boolean) {
  return cn(
    'flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors duration-150',
    'border-b border-gray-100 dark:border-gray-800',
    read
      ? isGeekStyle.value
        ? 'hover:bg-[#111]'
        : 'hover:bg-gray-50 dark:hover:bg-gray-800'
      : isGeekStyle.value
        ? 'bg-[#111]'
        : 'bg-blue-50 dark:bg-blue-900/20',
  )
}

function handleLogout() {
  Modal.confirm({
    title: '退出登录',
    content: '确定要退出当前账号吗？',
    okText: '确定',
    cancelText: '取消',
    centered: true,
    onOk: () => {
      userStore.logout()
      router.push('/login')
    },
  })
}
function handleUserMenuClick({ key }: { key: string }) {
  if (key === 'logout') {
    handleLogout()
  } else if (key === 'profile') {
    accountDrawerRef.value?.open('center')
  } else if (key === 'docs') {
    window.open('https://junjie73-blip.github.io/antdv-next-admin/', '_blank')
  }
}

function handleBreadcrumbClick(path: string) {
  router.push(path)
}

function handleHorizontalMenuSelect({ key }: { key: string }) {
  if (key.startsWith('/')) {
    router.push(key)
  }
  emit('topMenuSelect', key)
}
const wsUrl = computed(() => {
  const token = userStore.token
  if (!token) return ''
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}&type=notice`
})

const { data: wsData, status: wsStatus } = useWebSocket(wsUrl, {
  autoReconnect: true,
  onConnected() {
    console.log('WebSocket connected for notice')
  },
  onDisconnected() {
    console.log('WebSocket disconnected')
  },
  onError(error) {
    console.warn('WebSocket error:', error)
  },
})

watch(wsData, (newData) => {
  if (!newData) return
  try {
    const message = JSON.parse(newData)
    if (message.type === 'notice') {
      const notice = transformNotice(message.data)
      notifications.value.unshift(notice)
      unreadCount.value += 1
      if (showAllNotificationsModal.value) {
        allNotifications.value.unshift(notice)
        totalNotifications.value += 1
      }
      notification.open({
        title: '新通知',
        description: notice.title,
        icon: () =>
          h(Icon, {
            icon: noticeTypeConfig[notice.noticeType]?.icon || 'carbon:notification',
            style: { color: '#108ee9' },
          }),
        placement: 'bottomRight',
        duration: 3,
      })
    }
  } catch (e) {
    console.warn('Invalid WebSocket message:', e)
  }
})

function handleNotificationClick(item: NotificationItem) {
  if (item.isRead === 0) {
    markAsRead(item.noticeId)
  }
  showNotification.value = false
}
const renderNotificationItem = (item: NotificationItem) => (
  <div
    class="flex items-start gap-3 px-5 py-4 cursor-pointer transition-colors "
    onClick={() => markAsRead(item.noticeId)}
  >
    <div
      class={`w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 bg-gradient-to-br ${noticeTypeConfig[item.noticeType]?.gradient || 'from-gray-500 to-gray-400'}`}
    >
      <Icon
        icon={noticeTypeConfig[item.noticeType]?.icon || 'carbon:notification'}
        class="text-lg"
      />
    </div>
    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
          {item.title}
        </span>
        <span class="text-xs text-gray-400 flex-shrink-0">
          {item.publishTime || item.createdAt}
        </span>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{item.content}</p>
    </div>
    {!item.isRead && <div class="w-2 h-2 mt-2 rounded-full bg-blue-500 flex-shrink-0" />}
  </div>
)
onMounted(() => {
  fetchRecentNotifications()
})
</script>

<template>
  <header :class="headerClassName">
    <div class="flex items-center gap-4 flex-1">
      <!-- 垂直布局：面包屑 -->
      <template v-if="!horizontal && !mixed">
        <a-breadcrumb
          v-if="appStore.showBreadcrumb"
          class="hidden md:flex items-center"
          :items="breadcrumbItems"
        >
          <template #separator>
            <Icon icon="carbon:chevron-right" class="text-xs opacity-50" />
          </template>
          <template #titleRender="{ item, index }">
            <span
              class="inline-flex items-center gap-1.5 cursor-pointer"
              @click="handleBreadcrumbClick(item.path!)"
            >
              <Icon
                :icon="
                  index === 0 ? 'carbon:home' : breadcrumbs[index - 1]?.icon || 'carbon:folder'
                "
                class="text-sm"
              />
              <span>{{ item.title }}</span>
            </span>
          </template>
        </a-breadcrumb>
      </template>

      <!-- 水平布局：Logo + 水平菜单 -->
      <template v-else-if="horizontal">
        <div class="flex items-center gap-2">
          <Icon icon="carbon:cube" class="text-2xl text-ant-primary" />
          <span class="font-bold text-ant-primary">
            {{ appTitle }}
          </span>
        </div>

        <Menu
          mode="horizontal"
          :items="horizontalMenuItems"
          :theme="isDarkMode ? 'dark' : 'light'"
          class="flex-1 border-none bg-transparent"
          @select="handleHorizontalMenuSelect"
        />
      </template>

      <!-- 混合布局：Logo + 水平菜单 -->
      <template v-else-if="mixed">
        <div class="flex items-center gap-2 pr-4 border-r border-gray-200 dark:border-gray-700">
          <Icon
            icon="carbon:cube"
            class="text-2xl"
            :class="isGeekStyle ? 'text-[#00ff88]' : 'text-ant-primary'"
          />
          <span class="font-bold" :class="isGeekStyle ? 'text-[#00ff88]' : 'text-ant-primary'">
            {{ appTitle }}
          </span>
        </div>

        <Menu
          mode="horizontal"
          :items="horizontalMenuItems"
          :theme="isDarkMode ? 'dark' : 'light'"
          :selected-keys="[activeTopMenu || '']"
          class="flex-1 border-none bg-transparent"
          @select="handleHorizontalMenuSelect"
        />
      </template>
    </div>

    <div class="flex items-center gap-1">
      <!-- 通知中心 -->
      <Popover
        v-model:open="showNotification"
        trigger="click"
        placement="bottomRight"
        :overlay-class-name="isGeekStyle ? 'notification-popover-geek' : ''"
      >
        <template #content>
          <div class="w-[380px] overflow-hidden">
            <!-- 通知列表 -->
            <div class="max-h-[360px] overflow-y-auto bg-white dark:bg-gray-900">
              <a-empty v-if="notifications.length === 0" description="暂无通知"> </a-empty>
              <div
                v-for="item in notifications"
                :data-id="item.noticeId"
                :key="item.noticeId"
                class="group flex items-start gap-3 px-5 py-4 cursor-pointer transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                :class="{
                  'bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/20':
                    !item.isRead,
                }"
                @click="handleNotificationClick(item)"
              >
                <div
                  class="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 bg-gradient-to-br"
                  :class="
                    noticeTypeConfig[item.noticeType]?.gradient || 'from-gray-500 to-gray-400'
                  "
                >
                  <Icon
                    :icon="noticeTypeConfig[item.noticeType]?.icon || 'carbon:notification'"
                    class="text-lg"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                      {{ item.title }}
                    </span>
                    <span class="text-xs text-gray-400 flex-shrink-0">
                      {{ item.publishTime || item.createdAt }}
                    </span>
                  </div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                    {{ item.content }}
                  </p>
                </div>
                <div
                  v-if="!item.isRead"
                  class="w-2 h-2 mt-2 rounded-full bg-blue-500 flex-shrink-0"
                />
              </div>
            </div>

            <!-- 底部查看全部 -->
            <div
              class="py-3 text-center border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900"
            >
              <a
                class="text-xs text-indigo-500 hover:text-indigo-600 cursor-pointer font-medium"
                @click="handleViewAllNotifications"
              >
                查看全部通知
              </a>
            </div>
          </div>
        </template>
        <Badge :count="unreadCount" :offset="[-2, 2]" :overflow-count="99">
          <div :class="actionBtnClassName">
            <Icon icon="carbon:notification" class="text-xl" />
          </div>
        </Badge>
      </Popover>

      <!-- 用户下拉 -->
      <Dropdown
        :menu="{ items: userDropdownItems, onClick: handleUserMenuClick }"
        placement="bottomRight"
      >
        <div
          class="flex items-center gap-2 cursor-pointer px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <a-avatar :size="32" class="bg-ant-primary" :src="userStore.avatar">
            {{ userStore.username?.charAt(0)?.toUpperCase() || 'U' }}
          </a-avatar>
          <span class="text-sm hidden sm:inline">{{ userStore.username || '用户' }}</span>
          <Icon icon="carbon:chevron-down" class="text-sm text-gray-400" />
        </div>
      </Dropdown>

      <!-- 系统设置 -->
      <div :class="actionBtnClassName" @click="showSetting = true">
        <Icon icon="carbon:settings" class="text-xl" />
      </div>
    </div>

    <SettingDrawer v-model:visible="showSetting" />
    <AccountDrawer ref="accountDrawerRef" />
  </header>
</template>

<style scoped>
:deep(.ant-breadcrumb-separator) {
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
