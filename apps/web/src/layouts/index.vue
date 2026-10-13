<script setup lang="ts">
import type { LayoutShellRegions, LayoutTone } from '@antdv/layout-ui';
import type { LayoutMode } from '@antdv/layouts';

import { computed, markRaw, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { useRouteLoading } from '@antdv/composables/useRouteLoading';
import { useWatermark } from '@antdv/composables/useWatermark';
import { LayoutShell } from '@antdv/layout-ui';
import { eventBus } from '@antdv/shared';
import { isExternalPath } from '@antdv/shared/menu';
import logoUrl from '~/assets/images/logo.png';
import PageLoading from '~/components/common/Loading/PageLoading.vue';
import RouteLoadingBar from '~/components/common/Loading/RouteLoadingBar.vue';
import { useDictStore } from '~/stores';
import { useAppStore } from '~/stores/modules/app';
import { useTabsStore } from '~/stores/modules/tabs';

import HeaderUser from './components/HeaderUser.vue';
import HeaderWidgets from './components/HeaderWidgets.vue';
import LayoutTabs from './components/LayoutTabs.vue';
import { useHeaderMenu } from './composables/useHeaderMenu';
import { useBreadcrumb, useShell } from './composables/useLayout';
import { usePageCache } from './composables/usePageCache';
import { useSidebarMenu } from './composables/useSidebarMenu';

defineOptions({
  name: 'DefaultLayout',
});

const router = useRouter();
const appStore = useAppStore();
const dictStore = useDictStore();
const tabsStore = useTabsStore();

/**
 * 外壳的全部区域开关都来自 `useShell()`：
 * 形态差异（垂直 / 双列 / 水平 / 侧边导航 / 混合垂直 / 混合双列 / 内容全屏）
 * 收敛在 `@antdv/layouts` 的蓝图表里，`@antdv/layout-ui` 只按开关渲染，
 * 这里既不再写 `layout === 'xxx'`，也不再手搭 `a-layout` 嵌套。
 */
const { blueprint, contentStyle, maximized, overlaySidebar, regions } =
  useShell();
const sidebarMenu = useSidebarMenu();
const headerNav = useHeaderMenu();
const { breadcrumbs } = useBreadcrumb();

/**
 * 页面缓存：include 与包装组件都出自 `usePageCache()`。
 * 直接拿路由 name 喂 include 是无效的——KeepAlive 匹配的是组件名，
 * 而文件约定路由的 name 形如 `/system/user/`，组件名是 `SystemUser` 或 `index`。
 */
const pageCache = usePageCache();
const cachedRoutes = pageCache.include;

/**
 * 交给壳的开关 = 蓝图区域开关 ∧ 用户偏好。
 *
 * `LayoutShellRegions` 要的是普通布尔（壳内不认 store），所以偏好在这里折进去：
 * 标签栏与底栏各有自己的显隐开关，蓝图只回答"这种形态有没有这一行"。
 */
const shellRegions = computed<LayoutShellRegions>(() => ({
  footerVisible: regions.footerVisible.value && appStore.showFooter,
  headerLead: blueprint.value.headerLead,
  headerNavVisible: regions.headerNavVisible.value,
  headerVisible: regions.headerVisible.value,
  navRailVisible: regions.navRailVisible.value,
  overlaySidebar: overlaySidebar.value,
  shellHidden: regions.chromeless.value || maximized.value,
  sidebarVisible: regions.sidebarVisible.value,
  tabsVisible: regions.tabsVisible.value && appStore.showTabs,
}));

/**
 * 配色档位。`geek` 恒深色、`dark` 看当前实际明暗（`auto` 要按 resolvedTheme 判断，
 * 直接比较 `theme` 字面量会在系统深色下失效），另两个是浅色模式下的「深色侧栏/顶栏」偏好。
 */
const tone = computed<LayoutTone>(() => ({
  dark: appStore.resolvedTheme === 'dark',
  geek: appStore.themeStyle === 'geek',
  headerDark: appStore.darkHeader,
  sidebarDark: appStore.darkSidebar,
}));

const sider = computed(() => ({
  collapsed: appStore.sidebarCollapsed,
  menus: sidebarMenu.menus.value,
  openKeys: sidebarMenu.openKeys.value,
  selectedKeys: sidebarMenu.selectedKeys.value,
  width: appStore.sidebarWidth,
}));

const rail = computed(() => ({
  activeKey: regions.railActiveKey.value,
  menus: regions.railMenus.value,
  width: appStore.railWidth,
}));

const footer = computed(() => ({
  company: appStore.copyrightCompany || 'Antdv Admin',
  icp: appStore.copyrightIcp,
  showCopyright: appStore.showCopyright,
}));

/**
 * 面包屑的 href 由这里生成，包内不 import vue-router。
 *
 * 不能图省事用 antd 面包屑的 `path`：它会把前面每一级拼到当前这一级
 * （`#/system/system/user`），中键 / 右键"新标签页打开"全指向不存在的页面。
 * `router.resolve` 则 hash 模式得到 `#/system/user`、history 模式得到 `/system/user`，
 * 切换历史模式不用改这里。外链返回 `undefined`，由包内按原样交给浏览器
 * （补 `target="_blank"`）。
 */
function resolveHref(path: string): string | undefined {
  return isExternalPath(path) ? undefined : router.resolve(path).href;
}

const breadcrumb = computed(() => ({
  enabled: appStore.showBreadcrumb,
  hideWhenOnlyOne: appStore.hideBreadcrumbWhenOnlyOne,
  items: breadcrumbs.value,
  resolveHref,
  showIcon: appStore.showBreadcrumbIcon,
}));

const appTitle = import.meta.env.VITE_APP_TITLE || 'Antdv Next Admin';

/**
 * 记住"进入内容全屏之前"是哪种形态。
 *
 * 内容全屏是个临时视角而不是最终布局：退出时要回到用户原来的那一列，
 * 否则一键退回"垂直"会让人以为布局设置被重置了。
 */
const previousLayout = ref<LayoutMode>('vertical');
watch(
  () => appStore.layout,
  (value) => {
    if (value !== 'full-content') previousLayout.value = value;
  },
  { immediate: true },
);

/** 右下角那颗退出按钮（壳里唯一入口）：放大态还原标签页，内容全屏还原布局 */
function handleExit(): void {
  if (maximized.value) {
    tabsStore.restore();
    return;
  }
  appStore.updateSetting({ layout: previousLayout.value });
}

/** 顶栏左侧那颗按钮：浮层形态开合抽屉，常驻形态折叠这一列 */
function toggleSidebar(): void {
  if (overlaySidebar.value) {
    appStore.updateSetting({
      sidebarOverlayOpen: !appStore.sidebarOverlayOpen,
    });
    return;
  }
  appStore.toggles.sidebarCollapsed();
}

/**
 * 抽屉开着时切换路由就自动收起 —— 手机上"点完菜单还压着内容区"是最难受的。
 * immediate 让"刷新时抽屉是开的"这种残留状态也一并归位。
 */
watch(
  () => router.currentRoute.value.fullPath,
  () => {
    if (overlaySidebar.value && appStore.sidebarOverlayOpen) {
      appStore.updateSetting({ sidebarOverlayOpen: false });
    }
  },
  { immediate: true },
);

/**
 * `router-view` 插槽给出的 `Component` 在导航解析期间是 `undefined`
 * （异步 chunk、重定向、初始渲染都会命中）。
 * 而 `markRaw(undefined)` 在 Vue 3.5 里直接抛
 * "Cannot convert undefined or null to object"，整棵布局树渲染失败——
 * 页面表现为登录后白屏、标签栏与菜单全部不出现。
 * 这里保留 markRaw（避免"组件被响应式包装"的告警），只把空值挡在前面。
 */
function rawComponent(component: unknown) {
  return component ? markRaw(component) : null;
}

onMounted(() => {
  dictStore.fetchAllDicts();
});

/**
 * 全局事件总线在这里清，不放顶栏。
 *
 * 迁移前它挂在 `LayoutHeader` 的 `onUnmounted` 上，而顶栏在"进入内容全屏 /
 * 标签页放大"时也会卸载 —— 于是切一次沉浸视角就把 WebSocket 通知的监听清空了，
 * 回来再也收不到推送。外壳（也就是这一层）卸载才代表真的离开后台。
 */
onUnmounted(() => {
  eventBus.clear();
});

/* 路由切换 loading 状态管理（增强版：集成性能监控） */
const {
  isLoading: isRouteLoading,
  isSlow,
  cancel: cancelRouteLoading,
} = useRouteLoading({
  minDuration: 400,
  auto: true,
});

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

  <LayoutShell
    :breadcrumb="breadcrumb"
    :content-style="contentStyle"
    :footer="footer"
    :logo="logoUrl"
    :maximized="maximized"
    :nav="headerNav.nav.value"
    :overlay-open="appStore.sidebarOverlayOpen"
    :regions="shellRegions"
    :rail="rail"
    :sider="sider"
    :title="appTitle"
    :tone="tone"
    @exit="handleExit"
    @navigate="sidebarMenu.openMenuByKey"
    @toggle-collapse="appStore.toggles.sidebarCollapsed"
    @toggle-sidebar="toggleSidebar"
    @update:open-keys="sidebarMenu.setOpenKeys"
    @update:overlay-open="
      (v: boolean) => appStore.updateSetting({ sidebarOverlayOpen: v })
    "
  >
    <template #tabs>
      <LayoutTabs />
    </template>

    <template #tools>
      <HeaderWidgets />
    </template>

    <template #user>
      <HeaderUser />
    </template>

    <!-- 加载态遮罩盖在内容之上、滚动之外：不随页面一起滚走 -->
    <template #content-overlay>
      <PageLoading
        :loading="isRouteLoading"
        variant="default"
        :error="isSlow"
      />
    </template>

    <PageTransition>
      <router-view v-slot="{ Component, route }">
        <!-- 微前端页面：禁用 out-in 模式，避免 iframe/微应用被 transition 销毁 -->
        <template v-if="route.meta?.microApp">
          <keep-alive :include="cachedRoutes">
            <component
              :is="pageCache.wrap(route.path, Component)"
              :key="pageCache.keyOf(route.path)"
            />
          </keep-alive>
        </template>
        <!-- 全屏大屏页面：禁用 transition + keepAlive，避免 ECharts 资源泄漏影响其他页面 -->
        <template v-else-if="route.meta?.noTransition">
          <component :is="rawComponent(Component)" :key="route.path" />
        </template>
        <!-- 普通页面：按标签页与菜单声明决定是否缓存，不使用 Transition 避免渲染冲突 -->
        <template v-else>
          <keep-alive :include="cachedRoutes">
            <component
              :is="pageCache.wrap(route.path, Component)"
              :key="pageCache.keyOf(route.path)"
            />
          </keep-alive>
        </template>
      </router-view>
    </PageTransition>
  </LayoutShell>
</template>
