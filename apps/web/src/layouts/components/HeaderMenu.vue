<script setup lang="ts">
import type { MenuProps } from 'antdv-next';

import type { ScrollbarType } from '@antdv/ui/scrollbar';

import { computed, useTemplateRef, watch } from 'vue';

import { LAYOUT_HEADER_ROW_STYLE } from '@antdv/layouts';
import { cn } from '@antdv/shared/cn';
import { Icon } from '@iconify/vue';
import { Menu } from 'antdv-next';

import { useHorizontalScroll } from '../composables/useHorizontalScroll';

defineOptions({ name: 'HeaderMenu' });

const props = withDefaults(
  defineProps<{
    items?: MenuProps['items'];
    selectedKeys?: string[];
    theme?: 'dark' | 'light';
    /** 关闭时回退为 antd 自带的「···」折叠 */
    scrollable?: boolean;
    /** 选中项在横向栏中的位置，变化时自动滚入可视区 */
    activeIndex?: number;
    geek?: boolean;
  }>(),
  {
    items: () => [],
    selectedKeys: () => [],
    theme: 'light',
    scrollable: true,
    activeIndex: -1,
    geek: false,
  },
);

const emit = defineEmits<{ select: [key: string] }>();

/**
 * 横向滚动那一层由封装的 Scrollbar 提供，滚动元素是它内部的 `.scrollbar__wrap`
 * （类名仍是 `.header-menu-scroll`，下面的 antd 菜单行高样式靠它）。
 * `wrap` 从组件实例上取到的是已解包的 DOM 元素，声明类型是 Ref，故显式转一次。
 */
const menuScrollbarRef = useTemplateRef<ScrollbarType>('menuScrollbar');
const scrollRef = computed<HTMLElement | undefined>(
  () => menuScrollbarRef.value?.wrap as unknown as HTMLElement | undefined,
);
const scroller = useHorizontalScroll(scrollRef, { step: 220 });

const canScroll = computed(() => props.scrollable);
/** 嵌套对象里的 ref 在模板中不会自动解包，这里统一用 computed 取布尔值 */
const dragging = computed(() => scroller.isDragging.value);
const showLeftEdge = computed(
  () => canScroll.value && scroller.canScrollLeft.value,
);
const showRightEdge = computed(
  () => canScroll.value && scroller.canScrollRight.value,
);

/**
 * antd 的横向菜单默认把溢出项收进「···」浮层，这与"横向滚动访问全部项"冲突。
 * 滚动模式下做两件事：
 * 1. 根节点 `w-max`，rc-overflow 量到的容器宽度恒等于内容宽度，
 *    于是所有项都留在 DOM 里，由外层容器负责横向滚动；
 * 2. 隐藏 rc-overflow 仍然渲染出来的「···」占位项（antd 样式不在 @layer 里，
 *    必须用 important 才压得住）。
 */
const menuClassName = computed(() =>
  cn(
    'border-none bg-transparent',
    canScroll.value && [
      'w-max!',
      'min-w-full!',
      'flex-nowrap!',
      // antd 的样式不在 @layer 里，普通 utility 压不过它，必须 important
      '[&_.ant-menu-overflow-item-rest]:hidden!',
    ],
    !canScroll.value && 'flex-1',
    props.theme === 'dark'
      ? '[&_.ant-menu-item]:text-slate-300 [&_.ant-menu-submenu-title]:text-slate-300'
      : '',
    props.geek
      ? '[&_.ant-menu-item-selected]:text-[#00ff88] [&_.ant-menu-submenu-selected]:text-[#00ff88]'
      : '[&_.ant-menu-item-selected]:text-ant-primary [&_.ant-menu-submenu-selected]:text-ant-primary',
    // 一级项排版
    '[&_.ant-menu-item]:rounded-lg',
    '[&_.ant-menu-horizontal]:border-b-0!',
  ),
);

/**
 * 用 `click` 而不是 `select`：antd 的 select 只在"选中项发生变化"时触发，
 * 于是停在 404 页（一级项回退高亮到第一项）再点同一个一级菜单时毫无反应。
 * 点击即导航，语义上更符合"导航栏"。
 */
function handleSelect(info: { key: string }) {
  emit('select', info.key);
}

watch(
  () => props.activeIndex,
  (index) => {
    if (index >= 0) scroller.scrollIndexIntoView(index);
  },
);

watch(
  () => props.items,
  () => scroller.update(),
);

const arrowClassName = computed(() =>
  cn(
    'z-10 flex size-7  shrink-0 items-center justify-center rounded-full',
    'border transition-colors duration-200',
    props.theme === 'dark'
      ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  ),
);
</script>

<template>
  <div data-layout-region="header-nav" class="flex min-w-0 flex-1 items-center gap-1">
    <button
      v-if="showLeftEdge"
      type="button"
      aria-label="向左滚动菜单"
      title="单击逐步滚动，双击滚到最左"
      :class="arrowClassName"
      @click="scroller.scrollByStep(-1)"
      @dblclick="scroller.scrollToEnd(-1)"
    >
      <Icon icon="carbon:chevron-left" />
    </button>

    <div
      class="relative min-w-0 flex-1"
      :style="LAYOUT_HEADER_ROW_STYLE"
    >
      <!--
        滚动条走封装组件：原先这里是"原生滚动条 + 把它藏起来"，
        藏是藏住了，但触摸板上并没有任何"还能往右滚"的视觉反馈，
        而系统条一旦在某些平台藏不掉（Firefox 的 scrollbar-width 优先级）就露馅。
        换成 Scrollbar 后，溢出一条和主题同色的细条，箭头/渐隐/拖拽照旧。
      -->
      <Scrollbar
        ref="menuScrollbar"
        root-class="h-full"
        :class="cn(canScroll && 'cursor-grab', dragging && 'cursor-grabbing')"
        wrap-class="header-menu-scroll overscroll-x-contain"
        view-class="h-full"
        @wheel="scroller.onWheel"
        @pointerdown="scroller.onPointerDown"
        @click.capture="scroller.onClickCapture"
      >
        <Menu
          mode="horizontal"
          :items="items"
          :selected-keys="selectedKeys"
          :theme="theme"
          :class="menuClassName"
          @click="handleSelect"
        />
      </Scrollbar>

      <!-- 边缘渐隐：提示还有更多菜单项 -->
      <div
        v-if="showLeftEdge"
        class="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent dark:from-gray-800"
      ></div>
      <div
        v-if="showRightEdge"
        class="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent dark:from-gray-800"
      ></div>
    </div>

    <button
      v-if="showRightEdge"
      type="button"
      aria-label="向右滚动菜单"
      title="单击逐步滚动，双击滚到最右"
      :class="arrowClassName"
      @click="scroller.scrollByStep(1)"
      @dblclick="scroller.scrollToEnd(1)"
    >
      <Icon icon="carbon:chevron-right" />
    </button>
  </div>
</template>

<style>
/*
 * 这里刻意**不**用 scoped：`.header-menu-scroll` 现在是 Scrollbar 组件内部的
 * 包裹层，拿不到本组件的 data-v 属性，写成 scoped 会整条失配
 * （表现是横向菜单行高退回 antd 默认值，选中下划线跟着错位）。
 * 类名本身足够独特，不会误伤别处。
 *
 * 藏原生滚动条那两行也删了 —— 封装组件自己会给 wrap 加
 * `scrollbar__wrap--hidden-default`，再写一遍就是重复且互相遮蔽。
 */
.header-menu-scroll {
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x;
}

/* antd 横向菜单默认带 min-width: 0 的 flex 行为，这里交给内容撑开 */
.header-menu-scroll .ant-menu-horizontal {
  line-height: 3.5rem;
}
</style>
