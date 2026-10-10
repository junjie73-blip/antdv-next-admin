<script setup lang="ts">
import type { LayoutMode } from '@antdv/layouts';

import { computed, markRaw, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import { useRouter } from 'vue-router';

import { useRouteLoading } from '@antdv/composables/useRouteLoading';
import { useWatermark } from '@antdv/composables/useWatermark';
import { LAYOUT_DRAWER_WIDTH } from '@antdv/layouts';
import { cn } from '@antdv/shared/cn';
import type { ScrollbarType } from '@antdv/ui/scrollbar';
import { Drawer } from 'antdv-next';
import PageLoading from '~/components/common/Loading/PageLoading.vue';
import RouteLoadingBar from '~/components/common/Loading/RouteLoadingBar.vue';
import { useDictStore } from '~/stores';
import { useAppStore } from '~/stores/modules/app';
import { useTabsStore } from '~/stores/modules/tabs';

import LayoutBreadcrumb from './components/LayoutBreadcrumb.vue';
import LayoutFooter from './components/LayoutFooter.vue';
import LayoutHeader from './components/LayoutHeader.vue';
import LayoutNavRail from './components/LayoutNavRail.vue';
import LayoutSidebar from './components/LayoutSidebar.vue';
import LayoutTabs from './components/LayoutTabs.vue';
import { useShell } from './composables/useLayout';
import { usePageCache } from './composables/usePageCache';

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
 * 收敛在 `@antdv/layouts` 的蓝图表里，这里只按开关渲染，不再写 `layout === 'xxx'`。
 */
const { blueprint, contentStyle, maximized, overlaySidebar, regions } =
  useShell();

/**
 * 页面缓存：include 与包装组件都出自 `usePageCache()`。
 * 直接拿路由 name 喂 include 是无效的——KeepAlive 匹配的是组件名，
 * 而文件约定路由的 name 形如 `/system/user/`，组件名是 `SystemUser` 或 `index`。
 */
const pageCache = usePageCache();
const cachedRoutes = pageCache.include;

/* 区域开关摊成顶层 ref：模板里 ref 会自动解包，嵌套在对象里的不会 */
const chromeless = computed(() => regions.chromeless.value);
const headerVisible = computed(() => regions.headerVisible.value);
const headerNavInFlow = computed(() => blueprint.value.headerLead === 'logo');
const navRailVisible = computed(
  () => regions.navRailVisible.value && !overlaySidebar.value,
);
const sidebarVisible = computed(
  () => regions.sidebarVisible.value && !overlaySidebar.value,
);
const tabsVisible = computed(
  () => regions.tabsVisible.value && appStore.showTabs,
);
const footerVisible = computed(
  () => regions.footerVisible.value && appStore.showFooter,
);

/** 内容全屏 / 标签页放大：只留内容区，外加一个退出入口 */
const shellHidden = computed(() => chromeless.value || maximized.value);

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

function exitFullContent(): void {
  appStore.updateSetting({ layout: previousLayout.value });
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

const isGeekStyle = computed(() => appStore.themeStyle === 'geek');

const layoutClassName = computed(() =>
  cn(
    'flex h-screen flex-col gap-4 overflow-hidden',
    isGeekStyle.value ? 'bg-[#0a0a0a]' : 'bg-gray-50 dark:bg-gray-900',
  ),
);

const contentClassName = computed(() =>
  cn(
    // 内容区自己不滚动了：滚动交给封装的 <Scrollbar>（见模板），这里只做
    // "列向 flex + 允许收缩"的容器，让 Scrollbar 的 flex-1 拿得到真实高度。
    // 内边距也一并挪进 Scrollbar 的 view-class —— 挂在滚动元素上会让滚动条
    // 被挤到 padding 外侧，且底部留白会被算进滚动高度。
    'box-border flex min-h-0 flex-1 flex-col',
    isGeekStyle.value ? 'bg-[#0a0a0a]' : 'bg-gray-50 dark:bg-gray-900',
  ),
);

/** 主内容区的滚动容器（封装 Scrollbar 的实例，不是 DOM 元素） */
const scrollbarRef = useTemplateRef<ScrollbarType>('mainScrollbar');

/**
 * 滚动到顶部。
 *
 * 走组件暴露的 `scrollTo` 而不是直接摸 DOM：原生滚动条被 `scrollbar-width: none`
 * 藏起来之后，滚动的那个元素在组件内部（`.scrollbar__wrap`），外面拿不到也不该拿。
 */
function scrollToTop() {
  scrollbarRef.value?.scrollTo({ left: 0, top: 0 });
}

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
  (window as any).__layoutScrollToTop = scrollToTop;
  dictStore.fetchAllDicts();
});
onUnmounted(() => {
  delete (window as any).__layoutScrollToTop;
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

  <a-layout :class="layoutClassName">
    <!-- 顶栏横贯全宽：水平 / 混合 / 侧边导航（Logo 在顶栏，侧栏从下一行开始） -->
    <LayoutHeader v-if="headerVisible && headerNavInFlow && !shellHidden" />

    <!--
      「图标栏 + 侧栏 + 内容列」这一整行必须是 a-layout，不能是 a-layout-content：
      antd 的 LayoutSider 通过 inject 把自己登记给**最近一层 Layout provider**，
      而 a-layout-content 不提供该上下文。写成 content 时侧栏会一路冒泡登记到最外层
      `.ant-layout` 上，外层因此拿到 `ant-layout-has-sider`（flex-direction: row），
      把我们的 `flex-col` 顶掉 —— 表现就是顶栏变成"左列"、侧栏和内容区被推到视口之外。
    -->
    <a-layout class="flex min-h-0 flex-1 overflow-hidden">
      <!-- 图标栏：双列菜单放一级，混合双列放二级 -->
      <LayoutNavRail v-if="navRailVisible" />

      <!-- 常驻侧栏：数据源由蓝图决定（整棵树 / 当前一级子树 / 图标栏子树） -->
      <LayoutSidebar v-if="sidebarVisible" />

      <!-- 主内容列 -->
      <a-layout class="flex min-w-0 flex-1 flex-col overflow-hidden">
        <!-- 顶栏嵌在内容列：垂直 / 双列（左侧栏占满整高，Logo 在侧栏顶部） -->
        <LayoutHeader v-if="headerVisible && !headerNavInFlow && !shellHidden" />

        <!--
          Logo 系形态（水平 / 侧边导航 / 混合）的顶栏被品牌位与横向导航占满，
          面包屑没有落脚点 —— 但它必须能被 `showBreadcrumb` 开关点亮，
          所以退到内容列的第一行，视觉上仍是"顶栏下面那条外壳"。
        -->
        <LayoutBreadcrumb
          v-if="headerVisible && headerNavInFlow && !shellHidden"
          variant="content"
        />

        <LayoutTabs v-if="tabsVisible" :show-icon="appStore.tabShowIcon !== false" />

        <a-layout-content
          :class="contentClassName"
          :style="contentStyle"
          class="relative"
        >
          <PageLoading
            :loading="isRouteLoading"
            variant="default"
            :error="isSlow"
          />
          <!--
            内容区滚动一律走封装的 <Scrollbar>：浏览器原生滚动条的宽度、颜色、
            出现时机都由操作系统决定，Windows 上那条 17px 的灰杠既压内容也对不上主题。
            `root-class="min-h-0 flex-1"` 让它在这个列向 flex 里拿满剩余高度，
            内边距挂在 view 上（见 contentClassName 的注释）。
          -->
          <Scrollbar
            ref="mainScrollbar"
            root-class="min-h-0 flex-1"
            view-class="p-4"
          >
            <PageTransition>
              <router-view v-slot="{ Component, route }">
              <!-- 微前端页面：禁用 out-in 模式，避免 iframe/微应用被 transition 销毁 -->
              <template v-if="route.meta?.microApp">
                <keep-alive :include="cachedRoutes">
                  <component :is="pageCache.wrap(route.path, Component)" :key="pageCache.keyOf(route.path)" />
                </keep-alive>
              </template>
              <!-- 全屏大屏页面：禁用 transition + keepAlive，避免 ECharts 资源泄漏影响其他页面 -->
              <template v-else-if="route.meta?.noTransition">
                <component :is="rawComponent(Component)" :key="route.path" />
              </template>
              <!-- 普通页面：按标签页与菜单声明决定是否缓存，不使用 Transition 避免渲染冲突 -->
              <template v-else>
                <keep-alive :include="cachedRoutes">
                  <component :is="pageCache.wrap(route.path, Component)" :key="pageCache.keyOf(route.path)" />
                </keep-alive>
              </template>
            </router-view>
          </PageTransition>
          </Scrollbar>
        </a-layout-content>

        <LayoutFooter v-if="footerVisible" />
      </a-layout>
    </a-layout>

    <!-- 浮层菜单：窄屏（或蓝图声明为浮层的形态）下把常驻侧栏升级为抽屉 -->
    <Drawer
      v-if="overlaySidebar && !shellHidden"
      :open="appStore.sidebarOverlayOpen"
      placement="left"
      :size="LAYOUT_DRAWER_WIDTH"
      :has-header="false"
      :closable="false"
      :styles="{ body: { padding: 0, display: 'flex' } }"
      @close="appStore.updateSetting({ sidebarOverlayOpen: false })"
    >
      <LayoutSidebar overlay />
    </Drawer>

    <!-- 隐藏外壳时唯一的退出入口：悬浮在右下角，避免用户「被困在」全屏页面里 -->
    <button
      v-if="shellHidden"
      type="button"
      class="fixed right-6 bottom-6 z-50 flex items-center gap-1.5 rounded-full bg-ant-primary px-4 py-2 text-sm text-white shadow-lg transition-opacity hover:opacity-90"
      :aria-label="maximized ? '还原标签页' : '退出内容全屏'"
      @click="maximized ? tabsStore.restore() : exitFullContent()"
    >
      <Icon :icon="maximized ? 'carbon:fit-to-screen' : 'carbon:exit'" />
      <span>{{ maximized ? '还原标签页' : '退出内容全屏' }}</span>
    </button>
  </a-layout>
</template>
