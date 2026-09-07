<script setup lang="ts">
import type { BreadcrumbProps, MenuProps } from 'antdv-next'

import { Icon } from '@iconify/vue'
import { Badge, Dropdown, Menu, Modal, Popover } from 'antdv-next'
import dayjs from 'dayjs'
import { computed, h, ref } from 'vue'
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

const showSetting = ref(false)
const showNotification = ref(false)
const accountDrawerRef = ref<InstanceType<typeof AccountDrawer> | null>(null)
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

const notificationTypeConfig: Record<string, { icon: string }> = {
  info: { icon: 'carbon:information-filled' },
  success: { icon: 'carbon:checkmark-filled' },
  warning: { icon: 'carbon:warning-filled' },
  error: { icon: 'carbon:error-filled' },
}

function handleMarkAllRead() {
  notifications.value.forEach(n => n.read = true)
}

function handleNotificationClick(item: NotificationItem) {
  item.read = true
  showNotification.value = false
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
  return breadcrumbs.value.map(item => ({
    title: item.title,
    path: item.path,
  }))
})

const horizontalMenuItems: MenuProps['items'] = computed(() => {
  const isHorizontal = appStore.layout === 'horizontal'
  return (routeStore.menus || []).map(menu => ({
    key: menu.path,
    icon: () => h(Icon, { icon: menu.icon || 'carbon:folder', class: 'text-lg' }),
    label: menu.title,
    children: isHorizontal && menu.children?.length
      ? menu.children.map(child => ({
          key: `${menu.path}/${child.path}`,
          label: child.title,
        }))
      : undefined,
  }))
})

const sizeOptions: MenuProps['items'] = [
  { key: 'small', label: '小' },
  { key: 'middle', label: '中' },
  { key: 'large', label: '大' },
]

const _localeOptions: MenuProps['items'] = [
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
  info: isGeekStyle.value ? 'bg-[#0a2a1a] text-[#00ff88]' : 'bg-blue-50 text-blue-500 dark:bg-blue-900/30 dark:text-blue-400',
  success: isGeekStyle.value ? 'bg-[#0a2a1a] text-[#00ff88]' : 'bg-green-50 text-green-500 dark:bg-green-900/30 dark:text-green-400',
  warning: isGeekStyle.value ? 'bg-[#2a2a0a] text-[#ffcc00]' : 'bg-yellow-50 text-yellow-500 dark:bg-yellow-900/30 dark:text-yellow-400',
  error: isGeekStyle.value ? 'bg-[#2a0a0a] text-[#ff4444]' : 'bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400',
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

function handleToggle() {
  emit('toggleCollapsed')
}

function handleThemeToggle(event: MouseEvent) {
  toggleThemeWithAnimation(event)
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

function handleSizeSelect({ key }: { key: string }) {
  appStore.updateSetting({ componentSize: key as 'small' | 'middle' | 'large' })
}

function _handleLocaleSelect({ key }: { key: string }) {
  setLocale(key as 'zh-CN' | 'en-US')
}

function handleThemeStyleSelect({ key }: { key: string }) {
  appStore.updateSetting({ themeStyle: key as 'default' | 'compact' | 'illustration' | 'bootstrap' | 'skeuomorphism' | 'glass' | 'geek' })
}

function handleUserMenuClick({ key }: { key: string }) {
  if (key === 'logout') {
    handleLogout()
  }
  else if (key === 'profile') {
    accountDrawerRef.value?.open('center')
  }
  else if (key === 'docs') {
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
</script>

<template>
  <header
    :class="headerClassName"
  >
    <div class="flex items-center gap-4 flex-1">
      <!-- 垂直布局：面包屑 -->
      <template v-if="!horizontal && !mixed">
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
            class="text-2xl text-ant-primary"
          />
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
          <span
            class="font-bold"
            :class="isGeekStyle ? 'text-[#00ff88]' : 'text-ant-primary'"
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

    <div class="flex items-center gap-1">
      <!-- 全局搜索 -->
      <div
        :class="actionBtnClassName"
        title="全局搜索 (Ctrl+K)"
      >
        <Icon
          icon="carbon:search"
          class="text-xl"
        />
      </div>

      <!-- 通知中心 -->
      <Popover
        v-model:open="showNotification"
        trigger="click"
        placement="bottomRight"
        :overlay-class-name="isGeekStyle ? 'notification-popover-geek' : ''"
      >
        <template #content>
          <div class="w-[340px]">
            <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <strong class="text-sm">通知</strong>
              <a-tag
                v-if="unreadCount > 0"
                color="blue"
                class="!cursor-pointer !text-xs"
                @click="handleMarkAllRead"
              >
                全部已读
              </a-tag>
            </div>
            <div class="max-h-[360px] overflow-y-auto">
              <div
                v-for="item in notifications"
                :key="item.id"
                :class="notificationItemClassName(item.read)"
                @click="handleNotificationClick(item)"
              >
                <div
                  class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  :class="notificationIconBgConfig[item.type]"
                >
                  <Icon
                    :icon="notificationTypeConfig[item.type].icon"
                    class="text-base"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium truncate">
                    {{ item.title }}
                  </div>
                  <div class="text-xs text-gray-400 mt-0.5 truncate">
                    {{ item.description }}
                  </div>
                </div>
                <span class="text-xs text-gray-400 flex-shrink-0 mt-0.5">
                  {{ item.time }}
                </span>
              </div>
              <div
                v-if="notifications.length === 0"
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
            </div>
            <div class="py-2 text-center border-t border-gray-100 dark:border-gray-800">
              <a
                class="text-xs text-ant-primary hover:underline cursor-pointer"
                @click="showNotification = false"
              >
                查看全部通知
              </a>
            </div>
          </div>
        </template>
        <Badge
          :count="unreadCount"
          :offset="[-2, 2]"
          :overflow-count="99"
        >
          <div :class="actionBtnClassName">
            <Icon
              icon="carbon:notification"
              class="text-xl"
            />
          </div>
        </Badge>
      </Popover>

      <!-- 用户下拉 -->
      <Dropdown
        :menu="{ items: userDropdownItems, onClick: handleUserMenuClick }"
        placement="bottomRight"
      >
        <div class="flex items-center gap-2 cursor-pointer px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
          <a-avatar
            :size="32"
            class="bg-ant-primary"
          >
            {{ userStore.username?.charAt(0)?.toUpperCase() || 'U' }}
          </a-avatar>
          <span class="text-sm hidden sm:inline">{{ userStore.username || '用户' }}</span>
          <Icon
            icon="carbon:chevron-down"
            class="text-sm text-gray-400"
          />
        </div>
      </Dropdown>

      <!-- 系统设置 -->
      <div
        :class="actionBtnClassName"
        @click="showSetting = true"
      >
        <Icon
          icon="carbon:settings"
          class="text-xl"
        />
      </div>
    </div>

    <SettingDrawer v-model:visible="showSetting" />
    <AccountDrawer ref="accountDrawerRef" />
  </header>
</template>

<style scoped>
:deep(.ant-breadcrumb-separator){
    display: flex;
    justify-content: center;
    align-items: center;
}
</style>
