<script setup lang="ts">
import {
  computed,
  markRaw,
  onMounted,
  onUnmounted,
  useTemplateRef,
} from 'vue'
import { useRouter } from 'vue-router'

import PageLoading from '~/components/common/Loading/PageLoading.vue'
import RouteLoadingBar from '~/components/common/Loading/RouteLoadingBar.vue'
import { useRouteLoading } from '~/composables/useRouteLoading'
import { useWatermark } from '~/composables/web/useWatermark'
import { useDictStore } from '~/stores'
import { useAppStore } from '~/stores/modules/app'
import { cn } from '~/utils/cn'

import LayoutFooter from './components/LayoutFooter.vue'
import LayoutHeader from './components/LayoutHeader.vue'
import LayoutSidebar from './components/LayoutSidebar.vue'
import LayoutTabs from './components/LayoutTabs.vue'
import { useMenuTree } from './composables/useMenuTree'
import { useLayout } from './composables/useLayout.js'

defineOptions({
  name: 'DefaultLayout',
})

const router = useRouter()
const appStore = useAppStore()
const { checkMobile } = useLayout()
const dictStore = useDictStore()
// 路由切换 loading 状态管理（增强版：集成性能监控）
const {
  isLoading: isRouteLoading,
  isSlow,
  cancel: cancelRouteLoading,
} = useRouteLoading({
  minDuration: 400,
  auto: true,
})

const cachedRoutes = computed(() =>
  router
    .getRoutes()
    .filter((route) => route.meta?.keepAlive)
    .map((route) => route.name as string),
)

/**
 * 混合布局下侧边栏要不要出现，由「当前路由所属一级菜单有没有子节点」推导，
 * 而不是记住用户上一次点了哪个一级菜单（旧实现写死了 '/system'）。
 */
const { hasSubMenus } = useMenuTree()

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

const showSidebar = computed(() => isVertical.value || (isMixed.value && hasSubMenus.value))

const layoutClassName = computed(() =>
  cn(
    'h-screen flex flex-col gap-4 overflow-hidden',
    isGeekStyle.value ? 'bg-[#0a0a0a]' : 'bg-gray-50 dark:bg-gray-900',
  ),
)

const contentClassName = computed(() =>
  cn(
    'p-4  flex-1  box-border',
    isGeekStyle.value ? 'bg-[#0a0a0a]' : 'bg-gray-50 dark:bg-gray-900',
  ),
)

// 主内容区滚动容器引用（供路由切换时回到顶部）
const scrollbarRef = useTemplateRef('mainScrollbar')

/** 滚动到顶部 */
function scrollToTop() {
  const el = scrollbarRef.value?.$el as HTMLElement | undefined
  if (el) {
    el.scrollTo({ top: 0, left: 0 })
  }
}

// 挂载到 window 供路由守卫调用
onMounted(() => {
  ;(window as any).__layoutScrollToTop = scrollToTop
  dictStore.fetchAllDicts()
})
onUnmounted(() => {
  delete (window as any).__layoutScrollToTop
})

useWatermark({
  content: computed(() => appStore.watermarkContent),
  enabled: computed(() => appStore.enableWatermark),
})
</script>

<template>
  <!-- 路由切换进度条（增强版：百分比 + 可取消 + 慢加载警告） -->
  <RouteLoadingBar
    :duration="250"
    :show-percentage="true"
    :cancellable="true"
    :slow-threshold="3000"
    @cancel="cancelRouteLoading"
  />

  <a-layout :class="layoutClassName">
    <!-- 水平 / 混合布局：顶部 Header（含 Logo + 横向导航栏） -->
    <LayoutHeader
      v-if="isHorizontal || isMixed"
      :show-collapse-trigger="showSidebar"
    />

    <a-layout-content class="flex flex-1 overflow-hidden">
      <!-- 垂直布局：整棵菜单树；混合布局：当前一级菜单的二级菜单 -->
      <LayoutSidebar v-if="showSidebar" :mixed="isMixed" />

      <!-- 主内容区域 -->
      <a-layout class="flex flex-1 flex-col overflow-hidden">
        <!-- 垂直布局：Header 在主区域内（折叠按钮 + 面包屑） -->
        <LayoutHeader v-if="isVertical" show-collapse-trigger />

        <LayoutTabs
          :has-children="isMixed && hasSubMenus"
          :show-icon="appStore.tabShowIcon ?? true"
        />

        <a-layout-content
          :class="contentClassName"
          class="relative overflow-hidden"
        >
          <PageLoading
            :loading="isRouteLoading"
            variant="default"
            :error="isSlow"
          />
          <PageTransition>
            <router-view v-slot="{ Component, route }">
              <!-- 微前端页面：禁用 out-in 模式，避免 iframe/微应用被 transition 销毁 -->
              <template v-if="route.meta?.microApp">
                <keep-alive :include="cachedRoutes">
                  <component :is="markRaw(Component)" :key="route.path" />
                </keep-alive>
              </template>
              <!-- 全屏大屏页面：禁用 transition + keepAlive，避免 ECharts 资源泄漏影响其他页面 -->
              <template v-else-if="route.meta?.noTransition">
                <component :is="markRaw(Component)" :key="route.path" />
              </template>
              <!-- 普通页面：使用 KeepAlive 缓存，但不使用 Transition 避免渲染冲突 -->
              <template v-else>
                <keep-alive :include="cachedRoutes">
                  <component :is="markRaw(Component)" :key="route.path" />
                </keep-alive>
              </template> </router-view
          ></PageTransition>
        </a-layout-content>

        <LayoutFooter v-if="appStore.showFooter" />
      </a-layout>
    </a-layout-content>
  </a-layout>
</template>
