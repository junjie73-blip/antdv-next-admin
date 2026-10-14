<script setup lang="ts">
import type { ScrollbarType } from '@antdv/scrollbar-ui';

import type { LayoutContentStyle, LayoutTone } from '../types';

import { computed, useTemplateRef } from 'vue';

import { Scrollbar } from '@antdv/scrollbar-ui';

import { useLayoutStyle } from '../useLayoutStyle';

defineOptions({ name: 'LayoutContent' });

const props = withDefaults(
  defineProps<{
    /** 内容区宽度策略（流式 / 定宽），来自 `resolveContentStyle` */
    contentStyle?: LayoutContentStyle;
    /** 沉浸视角（内容全屏 / 标签页放大）下不留这圈内边距 */
    padded?: boolean;
    tone?: LayoutTone;
  }>(),
  {
    contentStyle: undefined,
    padded: true,
    tone: () => ({}),
  },
);

const style = useLayoutStyle(() => props.tone);

const scrollbarRef = useTemplateRef<ScrollbarType>('contentScrollbar');

/**
 * 迁移前这个是挂在 `window.__layoutScrollToTop` 上的全局函数，
 * 现在随组件实例暴露，使用方 `ref` 到壳上就能调，不再污染 window。
 */
function scrollToTop() {
  scrollbarRef.value?.scrollTo({ left: 0, top: 0 });
}

defineExpose({ scrollToTop });

/** 内边距挂在 Scrollbar 的 view 上：挂在滚动元素上会把条挤到 padding 外侧 */
const viewClass = computed(() => (props.padded ? 'p-4' : ''));
</script>

<template>
  <main
    data-layout-region="content"
    :class="style.contentClass()"
    :style="props.contentStyle"
  >
    <!-- 覆盖在内容之上的加载态 / 进度遮罩，不参与滚动 -->
    <slot name="overlay"></slot>

    <Scrollbar
      ref="contentScrollbar"
      root-class="min-h-0 flex-1"
      :view-class="viewClass"
    >
      <slot></slot>
    </Scrollbar>
  </main>
</template>
