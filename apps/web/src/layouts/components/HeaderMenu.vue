<script setup lang="ts">
import type { MenuProps } from 'antdv-next';

import { computed, useTemplateRef, watch } from 'vue';

import { Icon } from '@iconify/vue';
import { Menu } from 'antdv-next';
import { cn } from '~/utils/cn';

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

const scrollRef = useTemplateRef('scrollRef');
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
 * antd 的横向菜单默认把溢出项收进「···」浮层。
 * 打开滚动模式时给菜单根节点 `w-max`，让 rc-overflow 量到的容器宽度
 * 恒等于内容宽度，于是所有项都留在 DOM 里，由外层容器负责横向滚动。
 */
const menuClassName = computed(() =>
  cn(
    'border-none bg-transparent',
    canScroll.value && [
      'w-max!',
      'min-w-full!',
      'flex-nowrap!',
      '[&_.ant-menu-overflow-item-rest]:hidden',
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
  <div class="flex min-w-0 flex-1 items-center gap-1">
    <button
      v-if="showLeftEdge"
      type="button"
      aria-label="向左滚动菜单"
      :class="arrowClassName"
      @click="scroller.scrollByStep(-1)"
    >
      <Icon icon="carbon:chevron-left" />
    </button>

    <div class="relative min-w-0 flex-1">
      <div
        ref="scrollRef"
        class="header-menu-scroll h-14 overflow-x-auto overscroll-x-contain"
        :class="cn(canScroll && 'cursor-grab', dragging && 'cursor-grabbing')"
        @wheel="scroller.onWheel"
        @pointerdown="scroller.onPointerDown"
        @pointermove="scroller.onPointerMove"
        @pointerup="scroller.onPointerUp"
        @pointercancel="scroller.onPointerUp"
        @click.capture="scroller.onClickCapture"
      >
        <Menu
          mode="horizontal"
          :items="items"
          :selected-keys="selectedKeys"
          :theme="theme"
          :class="menuClassName"
          @select="handleSelect"
        />
      </div>

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
      :class="arrowClassName"
      @click="scroller.scrollByStep(1)"
    >
      <Icon icon="carbon:chevron-right" />
    </button>
  </div>
</template>

<style scoped>
/* 隐藏横向滚动条但保留滚动能力（触摸板 / 拖拽 / 键盘均可用） */
.header-menu-scroll {
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x;
}

.header-menu-scroll::-webkit-scrollbar {
  display: none;
}

/* antd 横向菜单默认带 min-width: 0 的 flex 行为，这里交给内容撑开 */
.header-menu-scroll :deep(.ant-menu-horizontal) {
  line-height: 3.5rem;
}
</style>
