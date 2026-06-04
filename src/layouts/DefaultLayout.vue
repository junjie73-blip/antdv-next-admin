<script setup lang="ts">
import type { MenuProps } from 'antdv-next'

import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useWatermark } from '@/composables/web/useWatermark'
import { useAppStore } from '@/stores/modules/app'
import { useRouteStore } from '@/stores/modules/route'
import { cn } from '@/utils/cn'
import { transformMenuConfigToItems } from '@/utils/helpers/menu'
import LayoutFooter from './components/LayoutFooter.vue'
import LayoutHeader from './components/LayoutHeader.vue'
import LayoutSidebar from './components/LayoutSidebar.vue'
import LayoutTabs from './components/LayoutTabs.vue'
import { useLayout } from './composables/useLayout'

defineOptions({
  name: 'DefaultLayout',
})

const router = useRouter()
const appStore = useAppStore()
const routeStore = useRouteStore()
const { collapsed, checkMobile, toggleCollapsed } = useLayout()

const cachedRoutes = computed(() =>
  router.getRoutes()
    .filter(route => route.meta?.keepAlive)
    .map(route => route.name as string),
)

const activeTopMenu = ref('/system')

const allMenuItems = computed<MenuProps['items']>(() =>
  transformMenuConfigToItems(routeStore.menus),
)

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
const isGeekStyle = computed(() => appStore.themeStyle === 'geek')
const _isDarkMode = computed(() => appStore.themeMode === 'dark' || isGeekStyle.value)

const hasChildren = computed(() => {
  if (!isMixed.value || !activeTopMenu.value)
    return false
  const topMenu = allMenuItems.value.find(item => item?.key === activeTopMenu.value)
  return !!(topMenu && 'children' in topMenu && topMenu.children && topMenu.children.length > 0)
})

const layoutClassName = computed(() =>
  cn(
    'h-screen flex flex-col overflow-hidden',
    isGeekStyle.value
      ? 'bg-[#0a0a0a]'
      : 'bg-gray-50 dark:bg-gray-900',
  ),
)

const contentClassName = computed(() =>
  cn(
    'p-4 h-full',
    isGeekStyle.value
      ? 'bg-[#0a0a0a]'
      : 'bg-gray-50 dark:bg-gray-900',
  ),
)

const transitionName = computed(() => `page-${appStore.transitionEffect}`)

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
    <!-- 水平 / 混合布局：顶部 Header（含 Logo + 水平菜单） -->
    <LayoutHeader
      v-if="isHorizontal || isMixed"
      :collapsed="collapsed"
      :horizontal="isHorizontal"
      :mixed="isMixed"
      :active-top-menu="activeTopMenu"
      @toggleCollapsed="toggleCollapsed"
      @topMenuSelect="handleTopMenuSelect"
    />

    <div class="flex flex-1 overflow-hidden">
      <!-- 垂直布局：侧边栏 -->
      <LayoutSidebar
        v-if="isVertical"
        :collapsed="collapsed"
        @menuClick="() => {}"
      />

      <!-- 混合布局：侧边栏（有子菜单时才显示） -->
      <LayoutSidebar
        v-if="isMixed && hasChildren"
        :collapsed="collapsed"
        mixed
        :active-top-menu="activeTopMenu"
        @menuClick="() => {}"
      />

      <!-- 主内容区域 -->
      <div class="flex flex-col flex-1 overflow-hidden">
        <!-- 垂直布局：Header 在主区域内（折叠按钮 + 面包屑） -->
        <LayoutHeader
          v-if="isVertical"
          :collapsed="collapsed"
          @toggleCollapsed="toggleCollapsed"
        />

        <LayoutTabs
          :has-children="isMixed && hasChildren"
          :show-icon="appStore.tabShowIcon ?? true"
        />

        <PerfectScrollbar
          class="flex-1"
          :options="{ suppressScrollX: true, wheelPropagation: true }"
        >
          <main :class="contentClassName">
            <router-view v-slot="{ Component, route }">
              <!-- 微前端页面：禁用 out-in 模式，避免 iframe/微应用被 transition 销毁 -->
              <template v-if="route.meta?.microApp">
                <keep-alive :include="cachedRoutes">
                  <component
                    :is="Component"
                    :key="route.path"
                  />
                </keep-alive>
              </template>
              <!-- 普通页面：保持原有过渡效果 -->
              <template v-else>
                <transition
                  :name="transitionName"
                  mode="out-in"
                >
                  <keep-alive :include="cachedRoutes">
                    <component
                      :is="Component"
                      :key="route.path"
                    />
                  </keep-alive>
                </transition>
              </template>
            </router-view>
          </main>
        </PerfectScrollbar>

        <LayoutFooter v-if="appStore.showFooter" />
      </div>
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
