<script setup lang="ts">
import type { BreadcrumbProps, MenuProps } from 'antdv-next'

import { Icon } from '@iconify/vue'
import { Badge, Dropdown, Menu } from 'antdv-next'
import { computed, h, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useThemeTransition } from '@/composables/web/useThemeTransition'
import { useAppStore } from '@/stores/modules/app'
import { useUserStore } from '@/stores/modules/user'
import { cn } from '@/utils/cn'
import { COLLAPSED_WIDTH, useBreadcrumb, useFullscreen } from '../composables/useLayout'
import MenuSearch from './MenuSearch.vue'
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

const showSearch = ref(false)
const showSetting = ref(false)
const appTitle = import.meta.env.VITE_APP_TITLE || 'Antdv Next Admin'

const isGeekStyle = computed(() => appStore.themeStyle === 'geek')
const isDarkMode = computed(() => appStore.themeMode === 'dark' || isGeekStyle.value)
const isVertical = computed(() => appStore.layout === 'vertical')

const headerClassName = computed(() =>
  cn(
    'fixed top-0 right-0 z-50',
    'h-12 px-4 flex items-center justify-between',
    'border-b shadow-sm',
    'transition-all duration-200',
    isGeekStyle.value
      ? 'bg-[#0a0a0a] border-[#1a1a1a] text-[#00ff88]'
      : isDarkMode.value
        ? 'bg-gray-800 border-gray-700 text-white'
        : 'bg-white border-gray-200 text-gray-800',
  ),
)

const headerStyle = computed(() => {
  if (props.horizontal || props.mixed) {
    return { left: 0 }
  }
  return {
    left: `${props.collapsed ? COLLAPSED_WIDTH : appStore.sidebarWidth}px`,
  }
})

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
</script>

<template>
  <header
    :class="headerClassName"
    :style="headerStyle"
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
      <div
        :class="actionBtnClassName"
        @click="showSearch = true"
      >
        <Icon
          icon="carbon:search"
          class="text-lg"
        />
      </div>

      <Badge
        :count="5"
        :offset="[-2,
                  2]"
      >
        <div :class="actionBtnClassName">
          <Icon
            icon="carbon:notification"
            class="text-lg"
          />
        </div>
      </Badge>

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
        :menu="{ items: localeOptions, selectedKeys: [appStore.locale], onClick: handleLocaleSelect }"
        placement="bottom"
        :arrow="{ pointAtCenter: true }"
      >
        <div :class="actionBtnClassName">
          <Icon
            icon="carbon:language"
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

    <MenuSearch v-model:visible="showSearch" />
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
