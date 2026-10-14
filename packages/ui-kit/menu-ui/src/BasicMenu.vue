<script setup lang="ts">
import type { ScrollbarType } from '@antdv/scrollbar-ui';
import type { MenuConfig, MenuKey } from '@antdv/types';

import { computed, useTemplateRef, watch } from 'vue';

import { IconifyIcon as Icon } from '@antdv/icons/icon';
import { Scrollbar } from '@antdv/scrollbar-ui';
import { cn } from '@antdv/shared/cn';
import { useHorizontalScroll } from '@antdv/shared/scroll';

import MenuList from './components/MenuList.vue';
import { menuRuntime } from './config';
import { provideMenuContext } from './context';
import { toMenuNodes } from './menu-tree';
import { useMenuStyle } from './useMenuStyle';

defineOptions({ name: 'BasicMenu' });

const props = withDefaults(
  defineProps<{
    /**
     * 横向形态下要滚进可视区的那一项（通常是当前页面）。
     * 迁移前传的是下标，靠 antd 的内部类去查节点；自绘后每项都带
     * `data-menu-key`，按 key 定位比按下标稳（截断、过滤都不影响）。
     */
    activeKey?: MenuKey;
    /** 侧栏折叠（只影响 inline：折叠后文字收起、子菜单改浮层） */
    collapsed?: boolean;
    /** 极客主题：选中色固定为荧光绿，不跟随明暗 */
    geek?: boolean;
    /** 缺图标的项也占一个图标位（侧栏要一列文字对齐，顶栏不需要） */
    keepIconSlot?: boolean;
    /** 每级缩进量，对应迁移前 antd 的 `inline-indent`（默认 16 而非 antd 的 24） */
    inlineIndent?: number;
    /** 只渲染到该深度：混合布局的一级导航传 1，水平布局传 Infinity */
    maxDepth?: number;
    menus: MenuConfig[];
    mode?: 'horizontal' | 'inline';
    /** 受控展开集：手风琴/路由定位策略留在应用侧，包内不自己记 */
    openKeys?: MenuKey[];
    /** 关闭时退化为原生横向滚动，不渲染箭头 */
    scrollable?: boolean;
    selectedKeys?: MenuKey[];
    theme?: 'dark' | 'light';
    /** 是否渲染子节点 */
    withChildren?: boolean;
  }>(),
  {
    activeKey: undefined,
    collapsed: false,
    geek: false,
    inlineIndent: 16,
    keepIconSlot: false,
    maxDepth: Infinity,
    mode: 'inline',
    openKeys: () => [],
    scrollable: true,
    selectedKeys: () => [],
    theme: 'light',
    withChildren: true,
  },
);

const emit = defineEmits<{
  select: [key: MenuKey];
  'update:openKeys': [keys: MenuKey[]];
}>();

const nodes = computed(() =>
  toMenuNodes(props.menus, {
    maxDepth: props.maxDepth,
    withChildren: props.withChildren,
  }),
);

const selectedSet = computed(() => new Set(props.selectedKeys));
const openSet = computed(() => new Set(props.openKeys));

const style = useMenuStyle(() => ({
  collapsed: props.collapsed,
  geek: props.geek,
  mode: props.mode,
  theme: props.theme,
}));

provideMenuContext({
  collapsed: computed(() => props.collapsed),
  indent: computed(() => props.inlineIndent),
  keepIconSlot: props.keepIconSlot,
  openKeys: openSet,
  selectedKeys: selectedSet,
  select: (node) => emit('select', node.key),
  style,
  // 只增删被点的那一项：级联收起与手风琴策略留在应用侧（迁移前在 `useSidebarMenu` 里算）
  toggle: (node) => {
    const keys = props.openKeys;
    emit(
      'update:openKeys',
      openSet.value.has(node.key)
        ? keys.filter((key) => key !== node.key)
        : [...keys, node.key],
    );
  },
});

/* ---------------- 横向形态的滚动 ---------------- */

const isHorizontal = computed(() => props.mode === 'horizontal');
const canScroll = computed(() => isHorizontal.value && props.scrollable);

/**
 * 滚动层由封装的 Scrollbar 提供，`wrap` 就是它内部的滚动元素（`.scrollbar__wrap`）。
 */
const scrollbarRef = useTemplateRef<ScrollbarType>('menuScrollbar');
const scrollContainer = computed(() => scrollbarRef.value?.wrap);
const scroller = useHorizontalScroll(scrollContainer, { step: 220 });
const dragging = computed(() => scroller.isDragging.value);

/** 选中项变化时滚进可视区（路由跳转、切换一级菜单都走这里） */
watch(
  () => [props.activeKey, props.selectedKeys] as const,
  () => {
    if (!isHorizontal.value) return;
    const key = props.activeKey ?? props.selectedKeys[0];
    if (key) scroller.scrollKeyIntoView(key);
  },
  { flush: 'post' },
);

watch(nodes, () => scroller.update());

const rootClass = computed(() =>
  cn(
    'menu-root min-w-0',
    isHorizontal.value
      ? cn('flex flex-1 items-center gap-1', canScroll.value && 'w-full')
      : 'flex flex-col',
  ),
);

/**
 * 横向菜单的溢出处理：滚动模式下让内容按自身宽度排（`w-max`），
 * 全部项都留在 DOM 里，由外层负责横向滚动；关掉滚动就退回原生滚动条。
 */
const listWrapClass = computed(() =>
  cn(
    'relative min-w-0 flex-1',
    isHorizontal.value && !props.scrollable && 'overflow-x-auto',
  ),
);

const arrowClass = computed(() =>
  cn(
    'z-10 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border',
    'transition-colors duration-200',
    props.theme === 'dark' || props.geek
      ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  ),
);
</script>

<template>
  <nav
    :class="rootClass"
    :data-menu-mode="mode"
    :data-menu-theme="theme"
    aria-label="menu"
    data-menu-root
  >
    <button
      v-if="canScroll && scroller.canScrollLeft.value"
      :aria-label="menuRuntime.t('shell.scrollMenuLeft')"
      :class="arrowClass"
      :title="menuRuntime.t('shell.scrollHintLeft')"
      type="button"
      @click="scroller.scrollByStep(-1)"
      @dblclick="scroller.scrollToEnd(-1)"
    >
      <Icon icon="carbon:chevron-left" />
    </button>

    <!-- 内联形态（侧栏 / 图标栏 / 浮层）不套滚动容器：滚动条归布局壳管，这里只管排版 -->
    <MenuList
      v-if="!isHorizontal"
      :nodes="nodes"
      variant="inline"
      data-menu-tree
    />

    <div v-else :class="listWrapClass">
      <Scrollbar
        v-if="canScroll"
        ref="menuScrollbar"
        :class="cn(canScroll && 'cursor-grab', dragging && 'cursor-grabbing')"
        root-class="h-full"
        wrap-class="menu-scroll overscroll-x-contain"
        view-class="h-full"
        @pointerdown="scroller.onPointerDown"
        @wheel="scroller.onWheel"
        @click.capture="scroller.onClickCapture"
      >
        <MenuList :nodes="nodes" variant="bar" data-menu-tree />
      </Scrollbar>
      <MenuList v-else :nodes="nodes" variant="bar" data-menu-tree />

      <!-- 边缘渐隐：提示还有更多菜单项（箭头只在溢出时出现，这两条同理） -->
      <div
        v-if="scroller.canScrollLeft.value"
        class="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent dark:from-gray-800"
      ></div>
      <div
        v-if="scroller.canScrollRight.value"
        class="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent dark:from-gray-800"
      ></div>
    </div>

    <button
      v-if="canScroll && scroller.canScrollRight.value"
      :aria-label="menuRuntime.t('shell.scrollMenuRight')"
      :class="arrowClass"
      :title="menuRuntime.t('shell.scrollHintRight')"
      type="button"
      @click="scroller.scrollByStep(1)"
      @dblclick="scroller.scrollToEnd(1)"
    >
      <Icon icon="carbon:chevron-right" />
    </button>
  </nav>
</template>

<style>
/*
 * 不写 scoped：`.menu-scroll` 是 Scrollbar 组件内部的包裹层，拿不到本组件的
 * data-v 属性，scoped 会整条失配。类名够独特，不会误伤别处。
 * `touch-action` 让触摸板/触屏的横向手势落在这一层，纵向仍交给页面滚动。
 */
.menu-scroll {
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x;
}
</style>
