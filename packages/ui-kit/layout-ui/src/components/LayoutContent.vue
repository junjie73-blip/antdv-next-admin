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

/**
 * 滚动那一层由封装的 Scrollbar 提供，滚动元素在它内部。
 *
 * 不用 `document.querySelector` 去摸：模板 ref 走组件实例，重渲染也不会失联。
 * `scrollbar__wrap` 类型上声明成 `Ref<HTMLElement>`，但 `defineExpose` 暴露的对象
 * 会被 Vue 用 proxyRefs 解包，实例上取到的其实就是 DOM 元素，只能显式转一次。
 */
const scrollbarRef = useTemplateRef<ScrollbarType>('contentScrollbar');

/**
 * 滚回顶部：走组件暴露的 `scrollTo`，不直接摸 DOM ——
 * 原生滚动条被藏起来之后，真正滚动的那个元素在组件内部，外面拿不到也不该拿。
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
