<script setup lang="ts">
import type { MenuKey } from '@antdv/types';

import type {
  LayoutBreadcrumbConfig,
  LayoutContentStyle,
  LayoutFooterConfig,
  LayoutNavConfig,
  LayoutRailConfig,
  LayoutShellRegions,
  LayoutSiderConfig,
  LayoutTone,
} from '../types';

import { computed } from 'vue';

import { IconifyIcon as Icon } from '@antdv/icons/icon';

import { layoutRuntime } from '../config';
import { useLayoutStyle } from '../useLayoutStyle';
import LayoutBreadcrumb from './LayoutBreadcrumb.vue';
import LayoutContent from './LayoutContent.vue';
import LayoutFooter from './LayoutFooter.vue';
import LayoutHeader from './LayoutHeader.vue';
import LayoutNavRail from './LayoutNavRail.vue';
import LayoutOverlay from './LayoutOverlay.vue';
import LayoutSider from './LayoutSider.vue';

defineOptions({ name: 'LayoutShell' });

/**
 * 外壳装配：把区域开关落到 DOM 上，并把同一份 `tone` / `logo` / `title` 发给各区域。
 *
 * 这里唯一值得留档的是**嵌套顺序**：
 * 「图标栏 + 侧栏 + 内容列」这一整行必须是横向 flex 容器，不能是内容容器。
 * 迁移前它写的是 `a-layout`，因为 antd 的 LayoutSider 通过 inject 把自己登记给
 * **最近一层 Layout provider**；写成 `a-layout-content` 时侧栏会一路冒泡登记到最外层
 * `.ant-layout`，外层因此拿到 `ant-layout-has-sider`（flex-direction: row），
 * 把我们的 `flex-col` 顶掉 —— 表现就是顶栏变成"左列"、侧栏和内容区被推到视口之外。
 * 自绘壳不再有那套 inject，但顺序一旦写反，症状一模一样，所以保留这段注释。
 *
 * 标签页 / 小部件 / 路由视图都留在插槽里：它们依赖各自的包（tabs-ui）或应用store，
 * 本包只负责把它们放在正确的那一行。
 */
const props = withDefaults(
  defineProps<{
    breadcrumb?: LayoutBreadcrumbConfig;
    contentStyle?: LayoutContentStyle;
    footer?: LayoutFooterConfig;
    logo?: string;
    /** 标签页「放大当前页」：退出入口的文案要说明点下去恢复的是什么 */
    maximized?: boolean;
    nav?: LayoutNavConfig;
    overlayOpen?: boolean;
    regions: LayoutShellRegions;
    rail?: LayoutRailConfig;
    sider?: LayoutSiderConfig;
    title?: string;
    tone?: LayoutTone;
  }>(),
  {
    breadcrumb: undefined,
    contentStyle: undefined,
    footer: undefined,
    logo: undefined,
    maximized: false,
    nav: undefined,
    overlayOpen: false,
    rail: undefined,
    sider: undefined,
    title: undefined,
    tone: () => ({}),
  },
);

const emit = defineEmits<{
  /** 退出内容全屏 / 还原标签页 */
  exit: [];
  navigate: [key: MenuKey];
  toggleCollapse: [];
  toggleSidebar: [];
  'update:openKeys': [keys: MenuKey[]];
  'update:overlayOpen': [open: boolean];
}>();

const style = useLayoutStyle(() => props.tone);

/** Logo 系形态（水平 / 侧边导航 / 混合）的顶栏横贯全宽，面包屑退到内容列第一行 */
const headerNavInFlow = computed(() => props.regions.headerLead === 'logo');
const showHeader = computed(
  () => props.regions.headerVisible && !props.regions.shellHidden,
);
const showTopHeader = computed(
  () => showHeader.value && headerNavInFlow.value,
);
const showColumnHeader = computed(
  () => showHeader.value && !headerNavInFlow.value,
);

/** 浮层形态下常驻侧栏让位（同一时间只能有一列菜单） */
const showSidebar = computed(
  () => props.regions.sidebarVisible && !props.regions.overlaySidebar,
);
const showNavRail = computed(
  () => props.regions.navRailVisible && !props.regions.overlaySidebar,
);
const showOverlay = computed(
  () => props.regions.overlaySidebar && !props.regions.shellHidden,
);

/**
 * 顶栏左侧的侧栏触发按钮。
 *
 * 常驻侧栏在场时，折叠入口住在这一列的底部（见 `LayoutSider`），顶栏不再重复一个；
 * 另两种情况仍要顶栏入口：
 * - 浮层形态（窄屏 / 抽屉）：侧栏是抽屉，没有"底部折叠条"这个位置；
 * - 只剩图标栏、侧栏因为当前分区没有子菜单而让位：那一列根本不渲染，按钮也没地方住。
 */
const hasSidebarArea = computed(
  () => props.regions.sidebarVisible || props.regions.navRailVisible,
);
const persistentSidebar = computed(
  () => props.regions.sidebarVisible && !props.regions.overlaySidebar,
);
const showSidebarTrigger = computed(
  () => hasSidebarArea.value && !persistentSidebar.value,
);

/** 触发按钮的图标要反映"点了会变成什么"：浮层看抽屉开合，常驻看折叠态 */
const sidebarOpen = computed(() =>
  props.regions.overlaySidebar
    ? props.overlayOpen
    : !props.sider?.collapsed,
);

/**
 * 侧栏 Logo 的默认值：图标栏在场时品牌位在图标栏，顶栏带 Logo 的形态在顶栏，
 * 这两种情况这一列都不该重复占一行高度。使用方显式传 `showLogo` 时以它为准。
 */
const siderProps = computed(() => ({
  collapsed: false,
  keepIconSlot: true,
  logo: props.logo,
  menus: [],
  openKeys: [],
  selectedKeys: [],
  ...props.sider,
  showLogo:
    props.sider?.showLogo ??
    (!showNavRail.value &&
      !headerNavInFlow.value &&
      !props.regions.overlaySidebar),
  tone: props.tone,
}));

const railProps = computed(() => ({
  ...props.rail,
  logo: props.rail?.logo ?? props.logo,
  // 图标栏没有数据时整列都不渲染（模板上按 `props.rail` 拦住），这里只补类型
  menus: props.rail?.menus ?? [],
  title: props.rail?.title ?? props.title,
  tone: props.tone,
}));

/**
 * 导航柱的显隐归蓝图（`headerNavVisible`），数据归使用方（`nav.menus`）：
 * 只看菜单非空的话，侧边导航这类"Logo 在顶栏、菜单在左列"的形态会被顶栏那份
 * 一级菜单多渲染一根柱 —— 同一个 `nav` 对象两处读，开关就永远对不上账。
 */
const navProps = computed(() =>
  props.regions.headerNavVisible && props.nav
    ? { ...props.nav, tone: props.tone }
    : undefined,
);

const breadcrumbProps = computed(() => ({
  ...props.breadcrumb,
  items: props.breadcrumb?.items ?? [],
}));

const exitLabel = computed(() =>
  layoutRuntime.t(
    props.maximized ? 'shell.restoreTabs' : 'shell.exitFullContent',
  ),
);
</script>

<template>
  <div :class="style.shellClass()">
    <!-- 顶栏横贯全宽：水平 / 混合 / 侧边导航（Logo 在顶栏，侧栏从下一行开始） -->
    <LayoutHeader
      v-if="showTopHeader"
      data-layout-shell="header-full"
      :lead="props.regions.headerLead"
      :nav="navProps"
      :show-sidebar-trigger="showSidebarTrigger"
      :sidebar-open="sidebarOpen"
      :title="props.title"
      :tone="props.tone"
      @navigate="emit('navigate', $event)"
      @toggle-sidebar="emit('toggleSidebar')"
    >
      <template #tools>
        <slot name="tools"></slot>
      </template>
      <template #user>
        <slot name="user"></slot>
      </template>
    </LayoutHeader>

    <div :class="style.rowClass()">
      <!-- 图标栏：双列菜单放一级，混合双列放二级 -->
      <LayoutNavRail
        v-if="showNavRail && props.rail"
        v-bind="railProps"
        @navigate="emit('navigate', $event)"
      />

      <!-- 常驻侧栏：数据源由蓝图决定（整棵树 / 当前一级子树 / 图标栏子树） -->
      <LayoutSider
        v-if="showSidebar"
        v-bind="siderProps"
        @navigate="emit('navigate', $event)"
        @toggle-collapse="emit('toggleCollapse')"
        @update:open-keys="emit('update:openKeys', $event)"
      />

      <!-- 主内容列 -->
      <div :class="style.columnClass()">
        <!-- 顶栏嵌在内容列：垂直 / 双列（左侧栏占满整高，Logo 在侧栏顶部） -->
        <LayoutHeader
          v-if="showColumnHeader"
          data-layout-shell="header-column"
          :lead="props.regions.headerLead"
          :nav="navProps"
          :show-sidebar-trigger="showSidebarTrigger"
          :sidebar-open="sidebarOpen"
          :title="props.title"
          :tone="props.tone"
          @navigate="emit('navigate', $event)"
          @toggle-sidebar="emit('toggleSidebar')"
        >
          <template #breadcrumb>
            <LayoutBreadcrumb
              v-if="props.breadcrumb"
              v-bind="breadcrumbProps"
              variant="header"
            />
          </template>
          <template #tools>
            <slot name="tools"></slot>
          </template>
          <template #user>
            <slot name="user"></slot>
          </template>
        </LayoutHeader>

        <!--
          Logo 系形态的顶栏被品牌位与横向导航占满，面包屑没有落脚点 ——
          但它必须能被 `showBreadcrumb` 开关点亮，所以退到内容列的第一行。
        -->
        <LayoutBreadcrumb
          v-if="showTopHeader && props.breadcrumb"
          v-bind="breadcrumbProps"
          variant="content"
        />

        <!-- 标签页栏来自 @antdv/tabs-ui 的 TabsBar，由使用方放在这一行 -->
        <slot v-if="props.regions.tabsVisible" name="tabs"></slot>

        <LayoutContent
          :content-style="props.contentStyle"
          :padded="!props.regions.shellHidden"
          :tone="props.tone"
        >
          <template #overlay>
            <slot name="content-overlay"></slot>
          </template>
          <slot></slot>
        </LayoutContent>

        <LayoutFooter v-if="props.regions.footerVisible" v-bind="props.footer" />
      </div>
    </div>

    <!-- 浮层菜单：窄屏（或蓝图声明为浮层的形态）下把常驻侧栏升级为抽屉 -->
    <LayoutOverlay
      v-if="showOverlay"
      :open="props.overlayOpen"
      :tone="props.tone"
      @update:open="emit('update:overlayOpen', $event)"
    >
      <LayoutSider
        v-bind="siderProps"
        overlay
        @navigate="emit('navigate', $event)"
        @update:open-keys="emit('update:openKeys', $event)"
      />
    </LayoutOverlay>

    <!-- 隐藏外壳时唯一的退出入口：悬浮在右下角，避免用户「被困在」全屏页面里 -->
    <button
      v-if="props.regions.shellHidden"
      type="button"
      data-layout-exit-full
      :class="style.exitButtonClass()"
      :aria-label="exitLabel"
      :title="exitLabel"
      @click="emit('exit')"
    >
      <Icon :icon="props.maximized ? 'carbon:fit-to-screen' : 'carbon:exit'" />
      <span>{{ exitLabel }}</span>
    </button>
  </div>
</template>
