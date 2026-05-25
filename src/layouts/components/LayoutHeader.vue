<script setup lang="ts">
import type { BreadcrumbProps, MenuProps } from 'antdv-next'

import { Icon } from '@iconify/vue'
import { Badge, Dropdown, Menu, Popover, Segmented } from 'antdv-next'
import dayjs from 'dayjs'
import { computed, h, ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import { useRouter } from 'vue-router'
import { useThemeTransition } from '@/composables/web/useThemeTransition'
import { useAppStore } from '@/stores/modules/app'
import { useUserStore } from '@/stores/modules/user'
import { cn } from '@/utils/cn'
import { useBreadcrumb, useFullscreen } from '../composables/useLayout'
import SettingDrawer from './SettingDrawer.vue'

const props = defineProps<{
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
const { breadcrumbs } = useBreadcrumb()
const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()
const { toggleThemeWithAnimation } = useThemeTransition()

const showSetting = ref(false)
const showNotification = ref(false)
const appTitle = import.meta.env.VITE_APP_TITLE || 'Antdv Next Admin'

interface NotificationItem {
  id: string
  title: string
  description: string
  time: string
  read: boolean
  type: 'info' | 'success' | 'warning' | 'error'
}

const notifications = ref<NotificationItem[]>([
  {
    id: '1',
    title: '系统更新通知',
    description: '系统将于今晚 22:00 进行版本更新，届时服务将短暂中断',
    time: dayjs().subtract(10, 'minute').format('YYYY-MM-DD HH:mm:ss'),
    read: false,
    type: 'warning',
  },
  {
    id: '2',
    title: '新用户注册',
    description: '有新用户「张三」注册了系统账号，请及时审核',
    time: dayjs().subtract(30, 'minute').format('YYYY-MM-DD HH:mm:ss'),
    read: false,
    type: 'info',
  },
  {
    id: '3',
    title: '任务完成',
    description: '数据备份任务已成功完成，共备份 2.3GB 数据',
    time: dayjs().subtract(2, 'hour').format('YYYY-MM-DD HH:mm:ss'),
    read: false,
    type: 'success',
  },
  {
    id: '4',
    title: '登录异常告警',
    description: '检测到来自异常 IP 的登录尝试，已自动拦截',
    time: dayjs().subtract(5, 'hour').format('YYYY-MM-DD HH:mm:ss'),
    read: true,
    type: 'error',
  },
  {
    id: '5',
    title: '存储空间不足',
    description: '服务器磁盘使用率已达 85%，请及时清理',
    time: dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
    read: true,
    type: 'warning',
  },
])

const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)

const notificationTab = ref<'all' | 'unread' | 'read'>('all')

const filteredNotifications = computed(() => {
  if (notificationTab.value === 'unread')
    return notifications.value.filter(n => !n.read)
  if (notificationTab.value === 'read')
    return notifications.value.filter(n => n.read)
  return notifications.value
})

const isEmpty = computed(() => filteredNotifications.value.length === 0)

const notificationTypeConfig: Record<string, { icon: string, color: string }> = {
  info: { icon: 'carbon:information-filled', color: 'text-blue-500' },
  success: { icon: 'carbon:checkmark-filled', color: 'text-green-500' },
  warning: { icon: 'carbon:warning-filled', color: 'text-yellow-500' },
  error: { icon: 'carbon:error-filled', color: 'text-red-500' },
}

const notificationTabItems = computed(() => [
  { label: '全部', value: 'all' as const },
  { label: `未读 (${unreadCount.value})`, value: 'unread' as const },
  { label: '已读', value: 'read' as const },
])

function handleMarkAllRead() {
  notifications.value.forEach(n => n.read = true)
}

function handleClearAll() {
  notifications.value = []
  showNotification.value = false
}

function handleNotificationClick(item: NotificationItem) {
  item.read = true
  showNotification.value = false
}

const isGeekStyle = computed(() => appStore.themeStyle === 'geek')
const isDarkMode = computed(() => appStore.themeMode === 'dark' || isGeekStyle.value)

const headerClassName = computed(() =>
  cn(
    'h-12 px-4 flex items-center justify-between',
    'border-b shadow-sm flex-shrink-0',
    isGeekStyle.value
      ? 'bg-[#0a0a0a] border-[#1a1a1a] text-[#00ff88]'
      : isDarkMode.value
        ? 'bg-gray-800 border-gray-700 text-white'
        : 'bg-white border-gray-200 text-gray-800',
  ),
)

const breadcrumbItems = computed<BreadcrumbProps['items']>(() => {
  const items: BreadcrumbProps['items'] = [
    {
      title: '首页',
      path: '/dashboard',
    },
  ]

  breadcrumbs.value.forEach((item) => {
    items.push({
      title: item.title,
      path: item.path,
    })
  })

  return items
})

const horizontalMenuItems: MenuProps['items'] = [
  {
    key: '/dashboard',
    icon: () => h(Icon, { icon: 'carbon:dashboard', class: 'text-lg' }),
    label: '仪表盘',
  },
  {
    key: '/system',
    icon: () => h(Icon, { icon: 'carbon:settings', class: 'text-lg' }),
    label: '系统管理',
  },
]

const sizeOptions: MenuProps['items'] = [
  { key: 'small', label: '小' },
  { key: 'middle', label: '中' },
  { key: 'large', label: '大' },
]

const localeOptions: MenuProps['items'] = [
  { key: 'zh-CN', label: '简体中文' },
  { key: 'en-US', label: 'English' },
  { key: 'ja-JP', label: '日本語' },
]

const themeStyleOptions: MenuProps['items'] = [
  { key: 'default', label: '默认风格' },
  { key: 'compact', label: '紧凑风格' },
  { key: 'illustration', label: '插画风格' },
  { key: 'bootstrap', label: '类Bootstrap风格' },
  { key: 'skeuomorphism', label: '拟物化风格' },
  { key: 'glass', label: '玻璃风格' },
  { key: 'geek', label: '极客风格' },
]

const userDropdownItems: MenuProps['items'] = [
  {
    key: 'profile',
    label: '个人中心',
    icon: () => h(Icon, { icon: 'carbon:user-avatar' }),
  },
  {
    key: 'settings',
    label: '账户设置',
    icon: () => h(Icon, { icon: 'carbon:settings' }),
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
    'w-8 h-8 rounded-md',
    'cursor-pointer',
    'transition-colors duration-200',
    isGeekStyle.value
      ? 'hover:bg-[#1a1a1a]'
      : isDarkMode.value
        ? 'hover:bg-gray-700'
        : 'hover:bg-gray-100',
  ),
)

const notificationItemClassName = (read: boolean) =>
  cn(
    'flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors duration-150',
    read
      ? isGeekStyle.value
        ? 'bg-[#0a0a0a] hover:bg-[#111]'
        : isDarkMode.value
          ? 'bg-gray-800 hover:bg-gray-750'
          : 'bg-white hover:bg-gray-50'
      : isGeekStyle.value
        ? 'bg-[#111] hover:bg-[#1a1a1a]'
        : isDarkMode.value
          ? 'bg-gray-750 hover:bg-gray-700'
          : 'bg-blue-50 hover:bg-blue-100',
  )

function handleToggle() {
  emit('toggleCollapsed')
}

function handleThemeToggle(event: MouseEvent) {
  toggleThemeWithAnimation(event)
}

function handleLogout() {
  userStore.logout()
  router.push('/login')
}

function handleSizeSelect({ key }: { key: string }) {
  appStore.setComponentSize(key as 'small' | 'middle' | 'large')
}

function handleLocaleSelect({ key }: { key: string }) {
  appStore.setLocale(key)
}

function handleThemeStyleSelect({ key }: { key: string }) {
  appStore.setThemeStyle(key as 'default' | 'compact' | 'illustration' | 'bootstrap' | 'skeuomorphism' | 'glass' | 'geek')
}

function handleUserMenuClick({ key }: { key: string }) {
  if (key === 'logout') {
    handleLogout()
  }
  else if (key === 'profile') {
    router.push('/profile')
  }
  else if (key === 'settings') {
    router.push('/settings')
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

useEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape' && !showSetting.value && !showNotification.value) {
    handleLogout()
  }
})
</script>

<template>
  <header
    :class="headerClassName"
  >
    <div class="flex items-center gap-4 flex-1">
      <!-- 垂直布局：折叠按钮 + 面包屑 -->
      <template v-if="!horizontal && !mixed">
        <div
          :class="actionBtnClassName"
          @click="handleToggle"
        >
          <Icon
            :icon="!collapsed ? 'ant-design:menu-fold-outlined' : 'ant-design:menu-unfold-outlined'"
            class="text-lg"
          />
        </div>

        <a-breadcrumb
          v-if="appStore.showBreadcrumb"
          class="hidden md:flex items-center"
          :items="breadcrumbItems"
        >
          <template #separator>
            <Icon
              icon="carbon:chevron-right"
              class="text-xs opacity-50"
            />
          </template>
          <template #titleRender="{ item, index }">
            <span
              class="inline-flex items-center gap-1.5 cursor-pointer"
              @click="handleBreadcrumbClick(item.path!)"
            >
              <Icon
                :icon="index === 0 ? 'carbon:home' : (breadcrumbs[index - 1]?.icon || 'carbon:folder')"
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
          <Icon
            icon="carbon:cube"
            class="text-2xl text-primary"
          />
          <span class="font-bold text-primary">
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
            :class="isGeekStyle ? 'text-[#00ff88]' : 'text-primary'"
          />
          <span
            class="font-bold"
            :class="isGeekStyle ? 'text-[#00ff88]' : 'text-primary'"
          >
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

    <div class="flex items-center gap-2">
      <Popover
        v-model:open="showNotification"
        trigger="click"
        placement="bottomRight"
        :overlay-class-name="isGeekStyle ? 'notification-popover-geek' : ''"
      >
        <template #content>
          <div class="w-[380px]">
            <div class="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
              <span class="text-sm font-medium">通知</span>
              <div class="flex items-center gap-2">
                <a-button
                  v-if="notifications.length > 0"
                  type="link"
                  size="small"
                  @click="handleMarkAllRead"
                >
                  全部已读
                </a-button>
                <a-button
                  v-if="notifications.length > 0"
                  type="link"
                  size="small"
                  danger
                  @click="handleClearAll"
                >
                  清空
                </a-button>
              </div>
            </div>

            <div class="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
              <Segmented
                block
                size="small"
                :value="notificationTab"
                :options="notificationTabItems"
                @change="(val) => { notificationTab = val as 'all' | 'unread' | 'read' }"
              />
            </div>

            <PerfectScrollbar class="h-[300px]">
              <div
                v-for="item in filteredNotifications"
                :key="item.id"
                :class="notificationItemClassName(item.read)"
                @click="handleNotificationClick(item)"
              >
                <Icon
                  :icon="notificationTypeConfig[item.type].icon"
                  class="text-lg mt-0.5 flex-shrink-0"
                  :class="notificationTypeConfig[item.type].color"
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span
                      class="text-sm leading-tight"
                      :class="item.read ? (isGeekStyle ? 'text-gray-400' : 'text-gray-600 dark:text-gray-300') : 'font-medium'"
                    >
                      {{ item.title }}
                    </span>
                    <span
                      v-if="!item.read"
                      class="w-2 h-2 rounded-full bg-primary flex-shrink-0"
                    />
                  </div>
                  <div class="text-xs text-gray-400 mt-0.5 truncate">
                    {{ item.description }}
                  </div>
                  <div class="text-xs text-gray-400 mt-1">
                    {{ item.time }}
                  </div>
                </div>
              </div>
              <div
                v-if="isEmpty"
                class="py-12 text-center"
              >
                <Icon
                  icon="carbon:notification-off"
                  class="text-4xl text-gray-300 dark:text-gray-600 mb-2"
                />
                <div class="text-sm text-gray-400">
                  暂无通知
                </div>
              </div>
            </PerfectScrollbar>
          </div>
        </template>
        <Badge
          :count="unreadCount"
          :offset="[-2, 2]"
        >
          <div :class="actionBtnClassName">
            <Icon
              icon="carbon:notification"
              class="text-lg"
            />
          </div>
        </Badge>
      </Popover>

      <Dropdown
        :menu="{ items: sizeOptions, selectedKeys: [appStore.componentSize], onClick: handleSizeSelect }"
        placement="bottom"
        :arrow="{ pointAtCenter: true }"
      >
        <div :class="actionBtnClassName">
          <Icon
            icon="carbon:grid"
            class="text-lg"
          />
        </div>
      </Dropdown>

      <Dropdown
        :menu="{ items: themeStyleOptions, selectedKeys: [appStore.themeStyle], onClick: handleThemeStyleSelect }"
        placement="bottom"
        :arrow="{ pointAtCenter: true }"
      >
        <div :class="actionBtnClassName">
          <Icon
            icon="carbon:color-palette"
            class="text-lg"
          />
        </div>
      </Dropdown>

      <div
        :class="actionBtnClassName"
        @click="toggleFullscreen"
      >
        <Icon
          :icon="isFullscreen ? 'radix-icons:exit-full-screen' : 'radix-icons:enter-full-screen'"
          class="text-lg"
        />
      </div>

      <div
        :class="actionBtnClassName"
        @click="handleThemeToggle"
      >
        <Icon
          :icon="isDarkMode ? 'carbon:moon' : 'carbon:sun'"
          class="text-lg"
        />
      </div>

      <div
        :class="actionBtnClassName"
        @click="showSetting = true"
      >
        <Icon
          icon="carbon:settings"
          class="text-lg"
        />
      </div>

      <Dropdown
        :menu="{ items: userDropdownItems, onClick: handleUserMenuClick }"
        placement="bottomRight"
      >
        <div class="flex items-center gap-2 cursor-pointer px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
          <a-avatar
            :size="28"
            class="bg-primary"
          >
            {{ userStore.username?.charAt(0)?.toUpperCase() || 'U' }}
          </a-avatar>
          <span class="text-sm hidden sm:inline">{{ userStore.username || '用户' }}</span>
        </div>
      </Dropdown>
    </div>

    <SettingDrawer v-model:visible="showSetting" />
  </header>
</template>

<style scoped>
:deep(.ant-breadcrumb-separator){
    display: flex;
    justify-content: center;
    align-items: center;
}
</style>
