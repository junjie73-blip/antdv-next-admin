<script setup lang="ts">
import { computed } from 'vue';

import { Menu } from 'antdv-next';
import logoIconUrl from '~/assets/images/logo.png';
import { useAppStore } from '~/stores/modules/app';
import { cn } from '~/utils/cn';

import { COLLAPSED_WIDTH } from '../composables/useLayout';
import { useSidebarMenu } from '../composables/useSidebarMenu';

defineOptions({ name: 'LayoutSidebar' });

defineProps<{
  mixed?: boolean;
}>();

const emit = defineEmits<{
  menuClick: [key: string];
}>();

const appStore = useAppStore();

// ★ Sider 折叠状态与 appStore 双向绑定
const collapsedModel = computed({
  get: () => appStore.sidebarCollapsed,
  set: (v) => appStore.updateSetting({ sidebarCollapsed: v }),
});

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

const appTitle = import.meta.env.VITE_APP_TITLE || 'Antdv Next Admin';
const isDarkMode = computed(() => appStore.themeMode === 'dark');

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

const logoClassName = computed(() =>
  cn(
    'flex h-14 items-center justify-center overflow-hidden border-b whitespace-nowrap transition-all duration-300',
    appStore.darkSidebar || isDarkMode.value
      ? 'border-gray-800'
      : 'border-gray-100',
  ),
);

const menuWrapperClassName =
  'flex-1 overflow-hidden px-2 py-3 [&_.ps__rail-y]:opacity-30 [&_.ps__rail-y]:transition-opacity hover:[&_.ps__rail-y]:opacity-60 [&_.ps__thumb-y]:bg-slate-300 [&_.ps__thumb-y]:rounded';

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

    // ---- 子菜单透明 + 缩进 ----
    '[&_.ant-menu-sub]:!bg-transparent',
    '[&_.ant-menu-sub_.ant-menu-item]:pl-12',

    // ---- 折叠态隐藏 label / extra ----
    '[&_.ant-menu-inline-collapsed_.menu-label-wrapper]:hidden',
    '[&_.ant-menu-inline-collapsed_.menu-extra]:hidden',

    // ---- 图标尺寸 ----
    '[&_.ant-menu-item_.anticon]:text-lg',
    '[&_.ant-menu-submenu-title_.anticon]:text-lg',
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
  <!-- ★ 用 a-layout-sider 替换 <aside> -->
  <a-layout-sider
    v-model:collapsed="collapsedModel"
    :width="appStore.sidebarWidth"
    :collapsed-width="COLLAPSED_WIDTH"
    :trigger="null"
    :collapsible="appStore.menuAccordion"
    :theme="menuTheme"
    :class="sidebarClassName"
    :style="{ height: '100%' }"
  >
    <!-- Logo 区域 -->
    <div v-if="!mixed" :class="logoClassName">
      <transition name="logo-fade" mode="out-in">
        <div
          v-if="appStore.sidebarCollapsed"
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

    <!-- 菜单区域 -->
    <div :class="menuWrapperClassName">
      <PerfectScrollbar
        class="h-full"
        :options="{
          suppressScrollX: true,
          suppressScrollY: false,
          wheelPropagation: false,
        }"
      >
        <Menu
          v-if="menuItems && menuItems.length > 0"
          :selected-keys="selectedKeys"
          :open-keys="openKeys"
          mode="inline"
          :theme="menuTheme"
          :items="menuItems"
          :inline-collapsed="appStore.sidebarCollapsed"
          :class="menuClassName"
          @select="handleMenuSelect"
          @open-change="handleOpenChange"
        />
      </PerfectScrollbar>
    </div>
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
