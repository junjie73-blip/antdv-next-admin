<script setup lang="ts">
import { computed } from 'vue';

import {
  LAYOUT_DRAWER_WIDTH,
  LAYOUT_HEADER_ROW_STYLE,
  LAYOUT_SIDEBAR_COLLAPSED_WIDTH,
} from '@antdv/layouts';
import { cn } from '@antdv/shared/cn';
import { Icon } from '@iconify/vue';
import { Menu } from 'antdv-next';
import logoIconUrl from '~/assets/images/logo.png';
import { useAppStore } from '~/stores/modules/app';

import { useShell } from '../composables/useLayout';
import { useSidebarMenu } from '../composables/useSidebarMenu';

defineOptions({ name: 'LayoutSidebar' });

const props = withDefaults(
  defineProps<{
    /**
     * 浮层模式（侧边导航形态 / 窄屏）：由抽屉负责定位与开合，
     * 这里不再折叠、不加 Logo 之外的留白，宽度用固定的抽屉宽度。
     */
    overlay?: boolean;
  }>(),
  { overlay: false },
);

const emit = defineEmits<{
  menuClick: [key: string];
}>();

/**
 * 每一级菜单的缩进量（antd 默认 24px）。
 *
 * antd 是按层级**内联**写 `padding-left: level * inlineIndent` 的，
 * 所以想改缩进只能从这个 prop 进去——类选择器打不过内联样式，
 * 原来那条 `[&_.ant-menu-sub_.ant-menu-item]:pl-12` 就是这样变成死代码的：
 * 它从来没生效过，深层级（组件示例 → 组件画廊 → 基础组件 → 卡片列表）
 * 于是被 4 × 24 = 96px 的缩进推到只剩两三个字的宽度，看起来像"样式坏了"。
 * 16px 一级时，四级仍留出约 130px 给标题。
 */
const SIDEBAR_INLINE_INDENT = 16;

const appStore = useAppStore();
const { blueprint, regions } = useShell();

/** 浮层里永远展开；常驻形态才受折叠开关影响 */
const collapsed = computed(
  () => !props.overlay && appStore.sidebarCollapsed,
);

/** a-layout-sider 的 v-model 需要一个可写目标；写入即回写偏好 */
const collapsedModel = computed({
  get: () => collapsed.value,
  set: (value: boolean) => appStore.updateSetting({ sidebarCollapsed: value }),
});

/** 图标栏形态下 Logo 在图标栏；顶栏带 Logo 的形态这里也不重复 */
const showLogo = computed(
  () =>
    !props.overlay &&
    !regions.navRailVisible.value &&
    blueprint.value.headerLead !== 'logo',
);

const sidebarWidth = computed(() =>
  props.overlay ? LAYOUT_DRAWER_WIDTH : appStore.sidebarWidth,
);

const {
  menuItems,
  selectedKeys,
  openKeys,
  handleOpenChange,
  handleSelect: jumpByMenu,
} = useSidebarMenu();

function handleMenuSelect(info: { key: string }) {
  jumpByMenu(info as never);
  emit('menuClick', info.key);
}

/** 折叠入口挪到侧栏底部：它的效果就在这一列上，按钮就该长在这一列 */
function toggleCollapsed() {
  appStore.toggles.sidebarCollapsed();
}

const appTitle = import.meta.env.VITE_APP_TITLE || 'Antdv Next Admin';
const isDarkMode = computed(() => appStore.resolvedTheme === 'dark');

const menuTheme = computed<'dark' | 'light'>(() =>
  appStore.darkSidebar || isDarkMode.value ? 'dark' : 'light',
);
const isLightSidebar = computed(
  () => !appStore.darkSidebar && !isDarkMode.value,
);

const sidebarClassName = computed(() =>
  cn(
    'relative',
    appStore.darkSidebar || isDarkMode.value
      ? 'border-r border-gray-800 bg-gray-900'
      : 'border-r border-gray-100 bg-white',
  ),
);

/** 底部折叠条：分隔线跟随侧栏配色，hover 反馈和菜单项用同一档强度 */
const collapseBarClassName = computed(() =>
  cn(
    'flex h-10 shrink-0 cursor-pointer items-center justify-center border-t',
    'transition-colors duration-200',
    appStore.darkSidebar || isDarkMode.value
      ? 'border-gray-800 text-gray-400 hover:bg-white/6 hover:text-gray-200'
      : 'border-gray-100 text-gray-500 hover:bg-gray-100 hover:text-gray-700',
  ),
);

const logoClassName = computed(() =>
  cn(
    // 高度不写 `h-14`：与顶栏同源，见 `LAYOUT_HEADER_ROW_STYLE`
    'flex shrink-0 items-center justify-center overflow-hidden border-b whitespace-nowrap transition-all duration-300',
    appStore.darkSidebar || isDarkMode.value
      ? 'border-gray-800'
      : 'border-gray-100',
  ),
);

/**
 * 菜单区的滚动容器：`min-h-0 flex-1` 让封装的 Scrollbar 在这个列向 flex 里
 * 拿满 Logo 之外的剩余高度（原先这里写 `overflow-hidden` + PerfectScrollbar，
 * 现在滚动条与滚动行为统一由 `@antdv/ui` 的 Scrollbar 负责）。
 */
const menuScrollbarRootClass = 'min-h-0 flex-1 px-2 py-3';

/** ★★ 核心：所有 antd 菜单样式通过 Tailwind 任意变体实现 */
const menuClassName = computed(() => {
  // 基础菜单结构
  const base = [
    '!border-e-0 !bg-transparent border-none!',

    // ---- 菜单项基线 ----
    '[&_.ant-menu-item]:relative',
    '[&_.ant-menu-item]:my-0.5',
    '[&_.ant-menu-item]:h-10',
    '[&_.ant-menu-item]:rounded-lg',
    '[&_.ant-menu-item]:leading-10',
    '[&_.ant-menu-item]:font-normal',
    '[&_.ant-menu-item]:transition-all',
    '[&_.ant-menu-item]:duration-200',
    '[&_.ant-menu-item]:w-full',

    // ---- submenu title 基线 ----
    '[&_.ant-menu-submenu-title]:relative',
    '[&_.ant-menu-submenu-title]:my-0.5',
    '[&_.ant-menu-submenu-title]:h-10',
    '[&_.ant-menu-submenu-title]:rounded-lg',
    '[&_.ant-menu-submenu-title]:leading-10',
    '[&_.ant-menu-submenu-title]:font-medium',
    '[&_.ant-menu-submenu-title]:transition-all',
    '[&_.ant-menu-submenu-title]:duration-200',

    // ---- 选中态：淡背景 + 主色文字 ----
    '[&_.ant-menu-item-selected]:!bg-[color-mix(in_srgb,var(--ant-color-primary)_8%,transparent)]',
    '[&_.ant-menu-item-selected]:!text-[var(--ant-color-primary)]',
    '[&_.ant-menu-item-selected]:font-semibold',

    // ---- 隐藏 antd 默认右侧选中条 ----
    '[&_.ant-menu-item-selected]:after:!hidden',

    // ---- 左侧竖线（用 ::before） ----
    "[&_.ant-menu-item-selected]:before:content-['']",
    '[&_.ant-menu-item-selected]:before:absolute',
    '[&_.ant-menu-item-selected]:before:left-0',
    '[&_.ant-menu-item-selected]:before:top-1/2',
    '[&_.ant-menu-item-selected]:before:-translate-y-1/2',
    '[&_.ant-menu-item-selected]:before:w-[3px]',
    '[&_.ant-menu-item-selected]:before:h-[22px]',
    '[&_.ant-menu-item-selected]:before:rounded-r-[3px]',
    '[&_.ant-menu-item-selected]:before:bg-[var(--ant-color-primary)]',
    '[&_.ant-menu-item-selected]:before:shadow-[0_0_6px_color-mix(in_srgb,var(--ant-color-primary)_60%,transparent)]',

    // ---- label 容器：flex 撑满 ----
    '[&_.ant-menu-title-content]:flex',
    '[&_.ant-menu-title-content]:items-center',
    '[&_.ant-menu-title-content]:flex-1',
    '[&_.ant-menu-title-content]:min-w-0',

    // ---- 子菜单透明 ----
    // 缩进不在这里做：antd 用内联 padding-left 按层级排，类选择器顶不过它，
    // 统一走 `:inline-indent`（见 SIDEBAR_INLINE_INDENT）。
    '[&_.ant-menu-sub]:!bg-transparent',

    // ---- 折叠态隐藏 label / extra ----
    '[&_.ant-menu-inline-collapsed_.menu-label-wrapper]:hidden',
    '[&_.ant-menu-inline-collapsed_.menu-extra]:hidden',

    // ---- 图标尺寸 ----
    // antd 给每一项的图标元素加了 `.ant-menu-item-icon`，`@iconify/vue` 渲染的
    // `<span>` 不是 `.anticon`，所以只写后者的话这条规则一直是空的。
    '[&_.ant-menu-item_.ant-menu-item-icon]:text-lg',
    '[&_.ant-menu-submenu-title_.ant-menu-item-icon]:text-lg',
    '[&_.ant-menu-submenu-arrow]:text-slate-400',
    '[&_.ant-menu-submenu-title:hover_.ant-menu-submenu-arrow]:text-slate-500',

    // ---- badge 微调 ----
    '[&_.ant-badge-count]:text-[11px]',
    '[&_.ant-badge-count]:h-4',
    '[&_.ant-badge-count]:min-w-4',
    '[&_.ant-badge-count]:leading-4',
    '[&_.ant-badge-count]:px-1',
    '[&_.ant-badge-count]:shadow-[0_0_0_1px_#fff]',
    '[&_.ant-badge-dot]:shadow-[0_0_0_1px_#fff]',

    // ---- 弹出子菜单（折叠悬浮）圆角 ----
    '[&_.ant-menu-submenu-popup_.ant-menu]:rounded-xl',
    '[&_.ant-menu-submenu-popup_.ant-menu]:p-1',
  ];

  // hover 反馈：浅色用主色 5% 叠加，深色用白色 6%
  const hoverClasses = isLightSidebar.value
    ? [
        '[&_.ant-menu-item:hover]:bg-[color-mix(in_srgb,var(--ant-color-primary)_5%,transparent)]',
        '[&_.ant-menu-submenu-title:hover]:bg-[color-mix(in_srgb,var(--ant-color-primary)_5%,transparent)]',
        '[&_.ant-menu-item:hover]:text-slate-800',
        '[&_.ant-menu-submenu-title:hover]:text-slate-800',
      ]
    : [
        '[&_.ant-menu-item:hover]:bg-white/6',
        '[&_.ant-menu-submenu-title:hover]:bg-white/6',
      ];

  // 深色 / 极客下的选中态加深
  const selectedClasses = isLightSidebar.value
    ? []
    : [
        '[&_.ant-menu-item-selected]:!bg-[color-mix(in_srgb,var(--ant-color-primary)_18%,transparent)]',
      ];

  return [...base, ...hoverClasses, ...selectedClasses].join(' ');
});
</script>

<template>
  <a-layout-sider
    v-model:collapsed="collapsedModel"
    data-layout-region="sidebar"
    :width="sidebarWidth"
    :collapsed-width="LAYOUT_SIDEBAR_COLLAPSED_WIDTH"
    :trigger="null"
    :collapsible="!overlay"
    :theme="menuTheme"
    :class="sidebarClassName"
    :style="{ height: '100%' }"
  >
    <!-- Logo 区域 -->
    <div
      v-if="showLogo"
      data-layout-logo="sidebar"
      :class="logoClassName"
      :style="LAYOUT_HEADER_ROW_STYLE"
    >
      <transition name="logo-fade" mode="out-in">
        <div
          v-if="collapsed"
          key="collapsed"
          class="flex items-center justify-center"
        >
          <img
            :src="logoIconUrl"
            :alt="appTitle"
            class="h-8 w-8 object-contain"
          />
        </div>
        <div
          v-else
          key="expanded"
          class="flex items-center justify-center gap-2.5 px-4"
        >
          <img
            :src="logoIconUrl"
            :alt="appTitle"
            class="h-8 w-8 object-contain"
          />
          <span
            class="truncate text-base font-semibold text-gray-800 dark:text-white"
          >
            {{ appTitle }}
          </span>
        </div>
      </transition>
    </div>

    <!-- 菜单区域：滚动一律走封装组件，不留系统原生滚动条 -->
    <Scrollbar
      :root-class="menuScrollbarRootClass"
      wrap-class="overflow-x-hidden"
    >
      <Menu
        v-if="menuItems && menuItems.length > 0"
        :selected-keys="selectedKeys"
        :open-keys="openKeys"
        mode="inline"
        :theme="menuTheme"
        :items="menuItems"
        :inline-collapsed="collapsed"
        :inline-indent="SIDEBAR_INLINE_INDENT"
        :class="menuClassName"
        @select="handleMenuSelect"
        @open-change="handleOpenChange"
      />
    </Scrollbar>

    <!--
      折叠入口：贴着这一列的底边。
      放在顶栏时，用户要点到右上角才收起"左边这一列"，动作和目标隔着整个屏幕；
      Vben 系的惯例也是把它做在侧栏底部的一条横杠上。
      浮层形态（抽屉 / 窄屏）不渲染——那里没有"折叠"可言，开合由抽屉负责。
    -->
    <button
      v-if="!overlay"
      data-layout-sidebar-collapse
      type="button"
      :class="collapseBarClassName"
      :aria-label="collapsed ? '展开菜单' : '收起菜单'"
      :aria-expanded="!collapsed"
      :title="collapsed ? '展开菜单' : '收起菜单'"
      @click="toggleCollapsed"
    >
      <Icon
        :icon="collapsed ? 'carbon:side-panel-open' : 'carbon:side-panel-close'"
        class="text-lg"
      />
    </button>
  </a-layout-sider>
</template>

<style scoped>
/* 保留原有菜单样式，只调整选择器 */
.logo-fade-enter-active,
.logo-fade-leave-active {
  transition: opacity 0.2s ease;
}
.logo-fade-enter-from,
.logo-fade-leave-to {
  opacity: 0;
}

/* 覆盖 antd-sider 默认内边距 / 圆角 */
:deep(.ant-layout-sider-children) {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* ... 其余 sidebar-light / sidebar-dark / sidebar-geek 样式保持不变 ... */
</style>
