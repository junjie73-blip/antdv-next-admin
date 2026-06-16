<script setup lang="ts">
import type { MenuProps } from 'antdv-next'

import { Menu } from 'antdv-next'
import { computed, unref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import logoIconUrl from '@/assets/images/logo-icon.svg'
import logoUrl from '@/assets/images/logo.svg'
import { useAppStore } from '@/stores/modules/app'
import { useRouteStore } from '@/stores/modules/route'
import { cn } from '@/utils/cn'
import { transformMenuConfigToItems } from '@/utils/helpers/menu'
import { COLLAPSED_WIDTH, useMenu } from '../composables/useLayout'

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

const _route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const routeStore = useRouteStore()
const { sidebarWidth } = appStore
const { selectedKeys, openKeys, handleOpenChange } = useMenu()

/** 计算菜单项层级（用于手风琴模式） */
const menuLevelKeys = computed(() => {
  const items = allMenuItems.value
  if (!items || items.length === 0)
    return {}
  const map: Record<string, number> = {}
  const walk = (list: any[], level = 1) => {
    for (const item of list) {
      if (item?.key)
        map[item.key] = level
      if (item?.children)
        walk(item.children, level + 1)
    }
  }
  walk(items as any[])
  return map
})

const _appTitle = import.meta.env.VITE_APP_TITLE || 'Antdv Next Admin'

const isGeekStyle = computed(() => appStore.themeStyle === 'geek')
const isDarkMode = computed(() => appStore.themeMode === 'dark' || isGeekStyle.value)

const menuTheme = computed(() => {
  if (isGeekStyle.value)
    return 'dark'
  return appStore.darkSidebar ? 'dark' : 'light'
})

const allMenuItems = computed<MenuProps['items']>(() => {
  const menus = unref(routeStore.menus)
  if (!menus || menus.length === 0) {
    return []
  }
  return transformMenuConfigToItems(menus)
})

const sidebarClassName = computed(() =>
  cn(
    'flex-shrink-0 h-full',
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

const menuItems = computed(() => {
  if (props.mixed && props.activeTopMenu) {
    const topMenu = allMenuItems.value.find(item => item?.key === props.activeTopMenu)
    if (topMenu && 'children' in topMenu && topMenu.children) {
      return topMenu.children
    }
    return []
  }
  return allMenuItems.value
})

const handleMenuSelect: MenuProps['onSelect'] = ({ key }) => {
  const keyStr = key as string
  // 外链菜单由 label 中的 <a> 标签处理，避免重复打开
  if (keyStr.startsWith('external:')) {
    return
  }
  if (keyStr.startsWith('/')) {
    router.push(keyStr)
  }
  emit('menuClick', keyStr)
}
</script>

<template>
  <aside
    :class="sidebarClassName"
    :style="{
      width: `${props.collapsed ? COLLAPSED_WIDTH : sidebarWidth}px`,
    }"
  >
    <!-- Logo 区域：混合布局时不显示 -->
    <div
      v-if="!mixed"
      :class="logoClassName"
    >
      <div
        class="flex items-center justify-center w-full px-2"
      >
        <img
          v-if="props.collapsed"
          :src="logoIconUrl"
          alt="A"
          class="w-8 h-8 object-contain"
        >
        <img
          v-else
          :src="logoUrl"
          alt="Antdv Next Admin"
          class="w-auto h-8 object-contain"
        >
      </div>
    </div>

    <!-- 菜单区域 -->
    <PerfectScrollbar
      class="flex-1"
      :options="{ suppressScrollX: true, suppressScrollY: false, wheelPropagation: false }"
    >
      <Menu
        v-model:selected-keys="selectedKeys"
        :open-keys="openKeys"
        mode="inline"
        :theme="menuTheme"
        :items="menuItems"
        :inline-collapsed="props.collapsed"
        @select="handleMenuSelect"
        @openChange="(keys: string[]) => handleOpenChange(keys, menuLevelKeys)"
      />
    </PerfectScrollbar>
  </aside>
</template>
