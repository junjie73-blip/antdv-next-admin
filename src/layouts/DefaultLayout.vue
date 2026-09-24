<script setup lang="ts">
import type { MenuProps } from "antdv-next";

import { computed, markRaw, onMounted, onUnmounted, ref, useTemplateRef } from "vue";
import { useRouter } from "vue-router";

import PageLoading from "~/components/common/Loading/PageLoading.vue";
import RouteLoadingBar from "~/components/common/Loading/RouteLoadingBar.vue";
import { useRouteLoading } from "~/composables/useRouteLoading";
import { useWatermark } from "~/composables/web/useWatermark";
import { useDictStore } from "~/stores";
import { useAppStore } from "~/stores/modules/app";
import { useRouteStore } from "~/stores/modules/route";
import { cn } from "~/utils/cn";
import { transformMenuConfigToItems } from "~/utils/helpers/menu";

import LayoutFooter from "./components/LayoutFooter.vue";
import LayoutHeader from "./components/LayoutHeader.vue";
import LayoutSidebar from "./components/LayoutSidebar.vue";
import LayoutTabs from "./components/LayoutTabs.vue";
import { useLayout } from "./composables/useLayout";

defineOptions({
  name: "DefaultLayout",
});

const router = useRouter();
const appStore = useAppStore();
const routeStore = useRouteStore();
const { collapsed, checkMobile, toggleCollapsed } = useLayout();
const dictStore = useDictStore();
const routeStroe = useRouteStore();
// 路由切换 loading 状态管理（增强版：集成性能监控）
const {
  isLoading: isRouteLoading,
  isSlow,
  cancel: cancelRouteLoading,
} = useRouteLoading({
  minDuration: 400,
  auto: true,
});

const cachedRoutes = computed(() =>
  router
    .getRoutes()
    .filter((route) => route.meta?.keepAlive)
    .map((route) => route.name as string),
);

const activeTopMenu = ref("/system");

const allMenuItems = computed<MenuProps["items"]>(() =>
  transformMenuConfigToItems(routeStore.menus),
);

function handleResize() {
  checkMobile();
}

onMounted(() => {
  checkMobile();
  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
});

const isVertical = computed(() => appStore.layout === "vertical");
const isHorizontal = computed(() => appStore.layout === "horizontal");
const isMixed = computed(() => appStore.layout === "mixed");
const isGeekStyle = computed(() => appStore.themeStyle === "geek");
const _isDarkMode = computed(() => appStore.themeMode === "dark" || isGeekStyle.value);

const hasChildren = computed(() => {
  if (!isMixed.value || !activeTopMenu.value) return false;
  const topMenu = allMenuItems.value?.find((item) => item?.key === activeTopMenu.value);
  return !!(topMenu && "children" in topMenu && topMenu.children && topMenu.children.length > 0);
});

const layoutClassName = computed(() =>
  cn(
    "h-screen flex flex-col gap-4 overflow-hidden",
    isGeekStyle.value ? "bg-[#0a0a0a]" : "bg-gray-50 dark:bg-gray-900",
  ),
);

const contentClassName = computed(() =>
  cn("p-4  flex-1  box-border", isGeekStyle.value ? "bg-[#0a0a0a]" : "bg-gray-50 dark:bg-gray-900"),
);

// 主内容区滚动容器引用（供路由切换时回到顶部）
const scrollbarRef = useTemplateRef("mainScrollbar");

/** 滚动到顶部 */
function scrollToTop() {
  const el = scrollbarRef.value?.$el as HTMLElement | undefined;
  if (el) {
    el.scrollTo({ top: 0, left: 0 });
  }
}

// 挂载到 window 供路由守卫调用
onMounted(() => {
  (window as any).__layoutScrollToTop = scrollToTop;
  console.log(router.getRoutes());
});
onUnmounted(() => {
  delete (window as any).__layoutScrollToTop;
});

function handleTopMenuSelect(key: string) {
  activeTopMenu.value = key;
}

useWatermark({
  content: computed(() => appStore.watermarkContent),
  enabled: computed(() => appStore.enableWatermark),
});
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
      <LayoutSidebar v-if="isVertical" :collapsed="collapsed" @menuClick="() => {}" />

      <!-- 混合布局：侧边栏（有子菜单时才显示） -->
      <LayoutSidebar
        v-if="isMixed && hasChildren"
        :collapsed="collapsed"
        mixed
        :active-top-menu="activeTopMenu"
        @menuClick="() => {}"
      />

      <!-- 主内容区域 -->
      <div class="flex flex-1 flex-col overflow-hidden">
        <!-- 垂直布局：Header 在主区域内（折叠按钮 + 面包屑） -->
        <LayoutHeader v-if="isVertical" :collapsed="collapsed" @toggleCollapsed="toggleCollapsed" />

        <LayoutTabs
          :has-children="isMixed && hasChildren"
          :show-icon="appStore.tabShowIcon ?? true"
        />

        <main :class="contentClassName" class="relative overflow-hidden">
          <PageLoading :loading="isRouteLoading" variant="default" :error="isSlow" />
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
        </main>

        <LayoutFooter v-if="appStore.showFooter" />
      </div>
    </div>
  </div>
</template>
