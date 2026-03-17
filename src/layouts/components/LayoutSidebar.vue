<script setup lang="ts">
import type { MenuProps } from 'antdv-next'

import { Icon } from '@iconify/vue'
import { Menu } from 'antdv-next'
import { computed, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/modules/app'
import { cn } from '@/utils/cn'
import { COLLAPSED_WIDTH, useLayout, useMenu } from '../composables/useLayout'

const props = defineProps<{
  collapsed?: boolean
  mixed?: boolean
  activeTopMenu?: string
}>()

const emit = defineEmits<{
  menuClick: [key: string]
}>()

defineOptions({
  name: 'LayoutSidebar',
})

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const { sidebarWidth } = useLayout()
const { selectedKeys, openKeys, handleOpenChange } = useMenu()

const appTitle = import.meta.env.VITE_APP_TITLE || 'Antdv Next Admin'

const isGeekStyle = computed(() => appStore.themeStyle === 'geek')
const isDarkMode = computed(() => appStore.themeMode === 'dark' || isGeekStyle.value)

const menuTheme = computed(() => {
  if (isGeekStyle.value)
    return 'dark'
  return appStore.darkSidebar ? 'dark' : 'light'
})

const sidebarClassName = computed(() =>
  cn(
    'fixed left-0 top-0 bottom-0 z-40',
    'flex flex-col',
    'transition-all duration-200 ease-in-out',
    'border-r',
    isGeekStyle.value
      ? 'bg-[#0a0a0a] text-[#00ff88] border-[#1a1a1a]'
      : appStore.darkSidebar || isDarkMode.value
        ? 'bg-gray-900 text-white border-gray-800'
        : 'bg-white text-gray-800 border-gray-200',
  ),
)

const logoClassName = computed(() =>
  cn(
    'h-12 flex items-center justify-center',
    'border-b',
    'overflow-hidden whitespace-nowrap',
    'transition-all duration-200',
    isGeekStyle.value
      ? 'border-[#1a1a1a]'
      : appStore.darkSidebar || isDarkMode.value
        ? 'border-gray-800'
        : 'border-gray-200',
  ),
)

const allMenuItems: MenuProps['items'] = [
  {
    key: '/dashboard',
    icon: () => h(Icon, { icon: 'carbon:dashboard', class: 'text-lg' }),
    label: '仪表盘',
  },
  {
    key: '/system',
    icon: () => h(Icon, { icon: 'carbon:settings', class: 'text-lg' }),
    label: '系统管理',
    children: [
      { key: '/system/user', label: '用户管理', icon: () => h(Icon, { icon: 'carbon:user', class: 'text-lg' }) },
      { key: '/system/role', label: '角色管理', icon: () => h(Icon, { icon: 'carbon:group', class: 'text-lg' }) },
    ],
  },
]

const menuItems = computed(() => {
  if (props.mixed && props.activeTopMenu) {
    const topMenu = allMenuItems.find(item => item?.key === props.activeTopMenu)
    if (topMenu && 'children' in topMenu && topMenu.children) {
      return topMenu.children
    }
    return []
  }
  return allMenuItems
})

const handleMenuSelect: MenuProps['onSelect'] = ({ key }) => {
  if (key.startsWith('/')) {
    router.push(key)
  }
  emit('menuClick', key as string)
}
</script>

<template>
  <aside
    :class="sidebarClassName"
    :style="{
      width: `${props.collapsed ? COLLAPSED_WIDTH : sidebarWidth}px`,
      top: mixed ? '48px' : 0,
    }"
  >
    <!-- Logo 区域：混合布局时不显示 -->
    <div
      v-if="!mixed"
      :class="logoClassName"
    >
      <div
        class="flex items-center justify-center w-full px-2 gap-2"
        :class="props.collapsed ? 'text-xl' : 'text-base'"
      >
        <Icon
          icon="carbon:cube"
          class="text-2xl flex-shrink-0"
          :class="isGeekStyle ? 'text-[#00ff88]' : 'text-primary'"
        />
        <span
          v-if="!props.collapsed"
          class="font-bold truncate"
          :class="isGeekStyle ? 'text-[#00ff88]' : 'text-primary'"
        >
          {{ appTitle }}
        </span>
      </div>
    </div>

    <!-- 菜单区域 -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden">
      <Menu
        v-model:selected-keys="selectedKeys"
        v-model:open-keys="openKeys"
        mode="inline"
        :theme="menuTheme"
        :items="menuItems"
        :inline-collapsed="props.collapsed"
        @select="handleMenuSelect"
        @openChange="handleOpenChange"
      />
    </div>
  </aside>
</template>
