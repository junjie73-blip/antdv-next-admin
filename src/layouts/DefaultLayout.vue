<script setup lang="ts">
import type { MenuProps } from 'antdv-next'

import { Icon } from '@iconify/vue'
import { h } from 'vue'
import { useWatermark } from '@/composables/web/useWatermark'
import { useAppStore } from '@/stores/modules/app'
import { cn } from '@/utils/cn'
import LayoutFooter from './components/LayoutFooter.vue'
import LayoutHeader from './components/LayoutHeader.vue'
import LayoutSidebar from './components/LayoutSidebar.vue'
import LayoutTabs from './components/LayoutTabs.vue'
import { COLLAPSED_WIDTH, useLayout } from './composables/useLayout'

defineOptions({
  name: 'DefaultLayout',
})

const appStore = useAppStore()
const { collapsed, isMobile, checkMobile, toggleCollapsed } = useLayout()

const activeTopMenu = ref('/system')

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

function handleResize() {
  checkMobile()
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

const isVertical = computed(() => appStore.layout === 'vertical')
const isHorizontal = computed(() => appStore.layout === 'horizontal')
const isMixed = computed(() => appStore.layout === 'mixed')

const hasChildren = computed(() => {
  if (!isMixed.value || !activeTopMenu.value)
    return false
  const topMenu = allMenuItems.find(item => item?.key === activeTopMenu.value)
  return !!(topMenu && 'children' in topMenu && topMenu.children && topMenu.children.length > 0)
})

const layoutClassName = computed(() =>
  cn(
    'min-h-screen',
    'bg-gray-50 dark:bg-gray-900',
  ),
)

const mainClassName = computed(() =>
  cn(
    'flex flex-col',
    'transition-all duration-200',
    'fixed top-12 right-0 bottom-0 left-0',
    'overflow-hidden',
  ),
)

const contentClassName = computed(() =>
  cn(
    'flex-1 p-4 overflow-auto',
    'bg-gray-50 dark:bg-gray-900',
  ),
)

const transitionName = computed(() => `page-${appStore.transitionEffect}`)

const mainStyle = computed(() => {
  const tabsHeight = appStore.showTabs ? 88 : 48

  if (isHorizontal.value) {
    return {
      left: 0,
      top: `${tabsHeight}px`,
    }
  }

  if (isMixed.value) {
    if (!hasChildren.value) {
      return {
        left: 0,
        top: `${tabsHeight}px`,
      }
    }
    return {
      left: `${collapsed.value ? COLLAPSED_WIDTH : appStore.sidebarWidth}px`,
      top: `${tabsHeight}px`,
    }
  }

  return {
    left: isMobile.value ? 0 : `${collapsed.value ? COLLAPSED_WIDTH : appStore.sidebarWidth}px`,
    top: `${tabsHeight}px`,
  }
})

function handleTopMenuSelect(key: string) {
  activeTopMenu.value = key
}

useWatermark({
  content: computed(() => appStore.watermarkContent),
  enabled: computed(() => appStore.enableWatermark),
})
</script>

<template>
  <div :class="layoutClassName">
    <!-- 垂直布局：侧边栏 -->
    <LayoutSidebar
      v-if="isVertical"
      :collapsed="collapsed"
      @menuClick="() => {}"
    />

    <!-- 混合布局：侧边栏（只显示子菜单） -->
    <LayoutSidebar
      v-if="isMixed && hasChildren"
      :collapsed="collapsed"
      mixed
      :active-top-menu="activeTopMenu"
      @menuClick="() => {}"
    />

    <div
      :class="mainClassName"
      :style="mainStyle"
    >
      <!-- Header -->
      <LayoutHeader
        :collapsed="collapsed"
        :horizontal="isHorizontal"
        :mixed="isMixed"
        :active-top-menu="activeTopMenu"
        @toggleCollapsed="toggleCollapsed"
        @topMenuSelect="handleTopMenuSelect"
      />

      <LayoutTabs :has-children="isMixed && hasChildren" />

      <main :class="contentClassName">
        <router-view v-slot="{ Component, route }">
          <transition
            :name="transitionName"
            mode="out-in"
          >
            <keep-alive :include="[]">
              <component
                :is="Component"
                :key="route.path"
              />
            </keep-alive>
          </transition>
        </router-view>
      </main>

      <LayoutFooter v-if="appStore.showFooter" />
    </div>
  </div>
</template>

<style scoped>
/* 淡入淡出 */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.3s ease;
}

.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
}

/* 滑动（水平） */
.page-slide-enter-active,
.page-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.page-slide-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.page-slide-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

/* 右滑 */
.page-slide-right-enter-active,
.page-slide-right-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.page-slide-right-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.page-slide-right-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

/* 左滑 */
.page-slide-left-enter-active,
.page-slide-left-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.page-slide-left-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}

.page-slide-left-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

/* 上滑 */
.page-slide-up-enter-active,
.page-slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.page-slide-up-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.page-slide-up-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

/* 下滑 */
.page-slide-down-enter-active,
.page-slide-down-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.page-slide-down-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.page-slide-down-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

/* 缩放 */
.page-zoom-enter-active,
.page-zoom-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.page-zoom-enter-from {
  opacity: 0;
  transform: scale(0.9);
}

.page-zoom-leave-to {
  opacity: 0;
  transform: scale(1.1);
}

/* 淡入滑动 */
.page-fade-slide-enter-active,
.page-fade-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.page-fade-slide-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.page-fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* 缩放淡入 */
.page-scale-enter-active,
.page-scale-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.page-scale-enter-from {
  opacity: 0;
  transform: scale(0.95);
}

.page-scale-leave-to {
  opacity: 0;
  transform: scale(1.05);
}

/* 翻转 */
.page-flip-enter-active,
.page-flip-leave-active {
  transition: all 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
  transform-style: preserve-3d;
}

.page-flip-enter-from {
  opacity: 0;
  transform: rotateY(90deg);
}

.page-flip-leave-to {
  opacity: 0;
  transform: rotateY(-90deg);
}
</style>
