<script setup lang="ts">
import type { MenuProps } from 'antdv-next'

import { Icon } from '@iconify/vue'
import { Menu } from 'antdv-next'
import { computed, nextTick, unref, watch } from 'vue'
import { useRouter } from 'vue-router'
import logoIconUrl from '@/assets/images/logo-icon.svg'
import { useAppStore } from '@/stores/modules/app'
import { useRouteStore } from '@/stores/modules/route'
import { cn } from '@/utils/cn'
import { transformMenuConfigToItems } from '@/utils/helpers/menu'
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

const router = useRouter()
const appStore = useAppStore()
const routeStore = useRouteStore()
const { sidebarWidth } = appStore
const { toggleCollapsed } = useLayout()
const { selectedKeys, openKeys, handleOpenChange, setMenuTree, syncMenuByRoute } = useMenu()
const allMenuItems = computed<MenuProps['items']>(() => {
  const menus = unref(routeStore.menus)
  if (!menus || menus.length === 0) {
    return []
  }
  return transformMenuConfigToItems(menus)
})

// 监听菜单数据，等菜单加载完后主动同步选中态
watch(
  allMenuItems,
  (items) => {
    if (items && items.length > 0) {
      setMenuTree(items as any[])
      syncMenuByRoute()
    }
  },
  { immediate: true },
)

// 混合布局下切换到子菜单时，也要重新同步
watch(
  () => props.activeTopMenu,
  () => {
    nextTick(() => syncMenuByRoute())
  },
)

const _appTitle = import.meta.env.VITE_APP_TITLE || 'Antdv Next Admin'

const isGeekStyle = computed(() => appStore.themeStyle === 'geek')
const isDarkMode = computed(() => appStore.themeMode === 'dark' || isGeekStyle.value)

const menuTheme = computed(() => {
  if (isGeekStyle.value) return 'dark'
  return appStore.darkSidebar ? 'dark' : 'light'
})

const isLightSidebar = computed(
  () => !appStore.darkSidebar && !isDarkMode.value && !isGeekStyle.value,
)

const collapseBtnClassName = computed(() =>
  cn(
    'absolute right-[-12px] top-1/2 -translate-y-1/2',
    'w-6 h-6 rounded-full',
    'flex items-center justify-center',
    'cursor-pointer z-[999]',
    'border shadow-sm',
    'transition-all duration-200',
    isGeekStyle.value
      ? 'text-gray-500 bg-[#0a0a0a] border-[#1a1a1a] hover:text-[#00ff88] hover:border-[#00ff88] hover:shadow-[0_2px_8px_rgba(0,255,136,0.2)]'
      : appStore.darkSidebar || isDarkMode.value
        ? 'text-gray-400 bg-gray-900 border-gray-700 hover:text-white hover:border-gray-500 hover:shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
        : 'text-gray-400 bg-white border-gray-200 hover:text-[var(--ant-color-primary)] hover:border-[var(--ant-color-primary)] hover:shadow-[0_2px_8px_rgba(37,99,235,0.2)]',
  ),
)

const sidebarClassName = computed(() =>
  cn(
    'relative flex-shrink-0 h-full',
    'flex flex-col',
    'transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
    'border-r',
    isGeekStyle.value
      ? 'bg-[#0a0a0a] border-[#1a1a1a]'
      : appStore.darkSidebar || isDarkMode.value
        ? 'bg-gray-900 border-gray-800'
        : 'bg-white border-gray-100',
  ),
)

const logoClassName = computed(() =>
  cn(
    'h-14 flex items-center justify-center',
    'border-b',
    'overflow-hidden whitespace-nowrap',
    'transition-all duration-300',
    isGeekStyle.value
      ? 'border-[#1a1a1a]'
      : appStore.darkSidebar || isDarkMode.value
        ? 'border-gray-800'
        : 'border-gray-100',
  ),
)

const menuWrapperClassName = computed(() =>
  cn(
    'flex-1 overflow-hidden',
    'px-2 py-3',
    // 浅色侧边栏菜单定制样式
    isLightSidebar.value ? 'sidebar-light' : '',
    // 深色侧边栏菜单定制样式
    (appStore.darkSidebar || isDarkMode.value) && !isGeekStyle.value ? 'sidebar-dark' : '',
    // 极客风格
    isGeekStyle.value ? 'sidebar-geek' : '',
  ),
)

const menuItems = computed(() => {
  if (props.mixed && props.activeTopMenu) {
    const topMenu = allMenuItems.value?.find((item: any) => item?.key === props.activeTopMenu)
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
    <!-- Logo 区域 -->
    <div v-if="!mixed" :class="logoClassName">
      <transition name="logo-fade" mode="out-in">
        <div v-if="props.collapsed" key="collapsed" class="flex items-center justify-center">
          <div
            class="w-9 h-9 rounded-lg bg-[var(--ant-color-primary)] flex items-center justify-center shadow-md shadow-[var(--ant-color-primary)]/20"
          >
            <img :src="logoIconUrl" alt="A" class="w-5 h-5 object-contain brightness-0 invert" />
          </div>
        </div>
        <div v-else key="expanded" class="flex items-center justify-center gap-2.5 px-4">
          <div
            class="w-8 h-8 rounded-lg bg-[var(--ant-color-primary)] flex items-center justify-center shadow-md shadow-[var(--ant-color-primary)]/20 flex-shrink-0"
          >
            <img
              :src="logoIconUrl"
              alt="A"
              class="w-4.5 h-4.5 object-contain brightness-0 invert"
            />
          </div>
          <span class="text-base font-semibold text-gray-800 truncate dark:text-white">
            {{ _appTitle }}
          </span>
        </div>
      </transition>
    </div>

    <!-- 菜单区域 -->
    <div :class="menuWrapperClassName">
      <PerfectScrollbar
        class="h-full"
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
          @openChange="handleOpenChange"
        />
      </PerfectScrollbar>
    </div>

    <!-- 折叠按钮 -->
    <div :class="collapseBtnClassName" @click="toggleCollapsed">
      <Icon
        icon="ant-design:left-outlined"
        class="text-sm transition-transform duration-200"
        :class="{ 'rotate-180': props.collapsed }"
      />
    </div>
  </aside>
</template>

<style scoped>
/* Logo 过渡动画 */
.logo-fade-enter-active,
.logo-fade-leave-active {
  transition: opacity 0.2s ease;
}

.logo-fade-enter-from,
.logo-fade-leave-to {
  opacity: 0;
}

/* ===================== 浅色侧边栏菜单定制 ===================== */
.sidebar-light :deep(.ant-menu) {
  background: transparent;
  border-inline-end: none !important;
}

.sidebar-light :deep(.ant-menu-item) {
  margin: 2px 0;
  border-radius: 8px;
  height: 40px;
  line-height: 40px;
  color: #4b5563;
  font-weight: 450;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  width: calc(100%);
}

.sidebar-light :deep(.ant-menu-item:hover) {
  color: #1f2937;
  background: #f3f4f6;
}

.sidebar-light :deep(.ant-menu-item.ant-menu-item-selected) {
  color: var(--ant-color-primary);
  background: color-mix(in srgb, var(--ant-color-primary) 8%, transparent);
  font-weight: 600;
}

.sidebar-light :deep(.ant-menu-item.ant-menu-item-selected::after) {
  display: none;
}

/* 选中项左侧指示条 */
.sidebar-light :deep(.ant-menu-item.ant-menu-item-selected) {
  position: relative;
}

.sidebar-light :deep(.ant-menu-item.ant-menu-item-selected::before) {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  border-radius: 0 3px 3px 0;
  background: var(--ant-color-primary);
}

/* 子菜单 */
.sidebar-light :deep(.ant-menu-submenu-title) {
  margin: 2px 0;
  border-radius: 8px;
  height: 40px;
  line-height: 40px;
  color: #4b5563;
  font-weight: 500;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-light :deep(.ant-menu-submenu-title:hover) {
  color: #1f2937;
  background: #f3f4f6;
}

.sidebar-light :deep(.ant-menu-submenu.ant-menu-submenu-open > .ant-menu-submenu-title) {
  color: #1f2937;
  font-weight: 600;
}

.sidebar-light :deep(.ant-menu-sub.ant-menu-inline) {
  background: transparent !important;
}

/* 子菜单项缩进微调 */
.sidebar-light :deep(.ant-menu-sub .ant-menu-item) {
  padding-left: 48px !important;
}

/* 图标样式 */
.sidebar-light :deep(.ant-menu-item .anticon),
.sidebar-light :deep(.ant-menu-submenu-title .anticon) {
  font-size: 18px;
  transition: color 0.2s;
}

.sidebar-light :deep(.ant-menu-item.ant-menu-item-selected .anticon) {
  color: var(--ant-color-primary);
}

/* 展开箭头 */
.sidebar-light :deep(.ant-menu-submenu-arrow) {
  color: #9ca3af;
  transition: color 0.2s;
}

.sidebar-light :deep(.ant-menu-submenu-title:hover .ant-menu-submenu-arrow) {
  color: #6b7280;
}

/* ===================== 深色侧边栏菜单定制 ===================== */
.sidebar-dark :deep(.ant-menu) {
  background: transparent;
  border-inline-end: none !important;
}

.sidebar-dark :deep(.ant-menu-item) {
  margin: 2px 0;
  border-radius: 8px;
  height: 40px;
  line-height: 40px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  width: calc(100%);
}

.sidebar-dark :deep(.ant-menu-item:hover) {
  background: rgba(255, 255, 255, 0.06);
}

.sidebar-dark :deep(.ant-menu-item.ant-menu-item-selected) {
  background: color-mix(in srgb, var(--ant-color-primary) 20%, transparent);
  font-weight: 600;
}

.sidebar-dark :deep(.ant-menu-item.ant-menu-item-selected::after) {
  display: none;
}

.sidebar-dark :deep(.ant-menu-item.ant-menu-item-selected::before) {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  border-radius: 0 3px 3px 0;
  background: var(--ant-color-primary);
}

.sidebar-dark :deep(.ant-menu-submenu-title) {
  margin: 2px 0;
  border-radius: 8px;
  height: 40px;
  line-height: 40px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-dark :deep(.ant-menu-submenu-title:hover) {
  background: rgba(255, 255, 255, 0.06);
}

.sidebar-dark :deep(.ant-menu-sub.ant-menu-inline) {
  background: transparent !important;
}

.sidebar-dark :deep(.ant-menu-sub .ant-menu-item) {
  padding-left: 48px !important;
}

/* ===================== 极客风格菜单定制 ===================== */
.sidebar-geek :deep(.ant-menu) {
  background: transparent;
  border-inline-end: none !important;
}

.sidebar-geek :deep(.ant-menu-item) {
  margin: 2px 0;
  border-radius: 4px;
  height: 40px;
  line-height: 40px;
  transition: all 0.15s ease;
  width: calc(100%);
}

.sidebar-geek :deep(.ant-menu-item.ant-menu-item-selected) {
  background: rgba(0, 255, 136, 0.08);
  color: #00ff88;
}

.sidebar-geek :deep(.ant-menu-item.ant-menu-item-selected::after) {
  display: none;
}

.sidebar-geek :deep(.ant-menu-submenu-title) {
  margin: 2px 0;
  border-radius: 4px;
  height: 40px;
  line-height: 40px;
  transition: all 0.15s ease;
}

.sidebar-geek :deep(.ant-menu-sub.ant-menu-inline) {
  background: transparent !important;
}

.sidebar-geek :deep(.ant-menu-sub .ant-menu-item) {
  padding-left: 48px !important;
}

/* ===================== 通用优化 ===================== */
/* 折叠状态下的 tooltip 弹出菜单也保持一致的圆角 */
:deep(.ant-menu-submenu-popup .ant-menu) {
  border-radius: 10px;
  padding: 4px;
}

:deep(.ant-menu-submenu-popup .ant-menu-item) {
  border-radius: 6px;
  margin: 2px 0;
}

/* 滚动条美化 */
:deep(.ps__rail-y) {
  opacity: 0.3;
  transition: opacity 0.2s;
}

:deep(.ps__rail-y:hover) {
  opacity: 0.6;
}

:deep(.ps__thumb-y) {
  border-radius: 4px;
  background: #cbd5e1;
}

:deep(.ps__thumb-y:hover) {
  background: #94a3b8;
}
</style>
