<script lang="ts" setup>
import type { ScrollbarProps } from './types';

import { computed, onMounted, ref, shallowRef, watch } from 'vue';

import { ScrollArea } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/cn';
import { unrefElement, useEventListener } from '@vueuse/core';
import { isNumber } from 'es-toolkit';

import { useResponsiveMaxHeight } from './useResponsiveMaxHeight';

defineOptions({ name: 'Scrollbar' });

const props = withDefaults(defineProps<ScrollbarProps>(), {
  // 包不读 app 配置：想要系统滚动条由调用方把自己的配置传进来
  native: false,
  wrapStyle: '',
  wrapClass: '',
  viewClass: '',
  viewStyle: '',
  tag: 'div',
  always: false,
  maxHeight: undefined,
  rootClass: undefined,
  hideDelay: 800,
});

const emit = defineEmits<{
  (e: 'scroll', payload: { scrollTop: number; scrollLeft: number }): void;
}>();

const rootRef = ref<HTMLElement>();
const nativeWrapRef = ref<HTMLElement>();

/** 真正的滚动盒：原生模式是自己的 div，自绘模式是 reka 的 viewport */
const wrap = shallowRef<HTMLElement>();

const responsiveMaxHeight = useResponsiveMaxHeight({
  referenceMaxHeight: () =>
    isNumber(props.maxHeight) ? props.maxHeight : 495,
});

// 显式声明再返回：直接 `return {}` 会被 TS 推成 `{ maxHeight?: undefined }`
const rootStyle = computed<Record<string, string>>(() => {
  const style: Record<string, string> = {};
  if (props.maxHeight != null) {
    style.maxHeight = responsiveMaxHeight.maxHeightPx.value;
  }
  return style;
});

const VIEWPORT_SELECTOR = '[data-reka-scroll-area-viewport]';

const resolveWrap = () => {
  const root = unrefElement(rootRef);
  wrap.value = props.native
    ? nativeWrapRef.value
    : (root?.querySelector<HTMLElement>(VIEWPORT_SELECTOR) ?? undefined);
};

onMounted(resolveWrap);
watch(() => props.native, resolveWrap, { flush: 'post' });

const handleScroll = () => {
  const el = wrap.value;
  if (!el) return;
  emit('scroll', { scrollTop: el.scrollTop, scrollLeft: el.scrollLeft });
};

useEventListener(wrap, 'scroll', handleScroll, { passive: true });

/**
 * `isNumber(NaN)` 为 true，还要排除非有限值：
 * NaN 写进 scrollTop 会被浏览器静默变成 0，调用方以为"滚回去了"。
 */
const isScrollValue = (value: number) =>
  isNumber(value) && Number.isFinite(value);

const setScrollTop = (value: number) => {
  if (wrap.value && isScrollValue(value)) wrap.value.scrollTop = value;
};

const setScrollLeft = (value: number) => {
  if (wrap.value && isScrollValue(value)) wrap.value.scrollLeft = value;
};

const scrollTo = (options: ScrollToOptions) => {
  wrap.value?.scrollTo(options);
};

defineExpose({
  wrap,
  setScrollTop,
  setScrollLeft,
  scrollTo,
});
</script>

<template>
  <div
    ref="rootRef"
    class="scrollbar relative flex min-h-0 flex-col overflow-hidden"
    :class="rootClass ?? 'h-full'"
    :style="rootStyle"
  >
    <!-- reka 的 viewport 会强制隐藏系统滚动条，native 只能自己滚 -->
    <div
      v-if="native"
      ref="nativeWrapRef"
      class="scrollbar__wrap min-h-0 w-full flex-1 overflow-auto"
      :class="wrapClass"
      :style="wrapStyle"
    >
      <component
        :is="tag"
        class="scrollbar__view"
        :class="viewClass"
        :style="viewStyle"
      >
        <slot></slot>
      </component>
    </div>

    <ScrollArea
      v-else
      class="scrollbar__area min-h-0 w-full flex-1"
      :type="always ? 'always' : 'hover'"
      :scroll-hide-delay="hideDelay"
      :viewport-class="cn('scrollbar__wrap', wrapClass)"
      :viewport-style="wrapStyle"
      scrollbar-class="p-0 data-[orientation=vertical]:w-1.5 data-[orientation=horizontal]:h-1.5"
      thumb-class="bg-muted-foreground/60 hover:bg-muted-foreground/80 transition-colors"
    >
      <component
        :is="tag"
        class="scrollbar__view"
        :class="viewClass"
        :style="viewStyle"
      >
        <slot></slot>
      </component>
    </ScrollArea>
  </div>
</template>

<!--
  样式随组件走，且刻意不写 `@apply`：独立 SFC style block 里没有 Tailwind 主题入口，
  构建期会报 `Cannot apply unknown utility class`，所以展开成等价原生 CSS。
  放在 @layer components 里，模板上的 utilities 仍能覆盖这里。
-->
<style>
@layer components {
  .scrollbar {
    position: relative;
    overflow: hidden;
    height: 100%;
  }

  .scrollbar__wrap {
    overflow: auto;
    height: 100%;
  }

  /*
   * reka 在 viewport 与 slot 之间插了一层没有高度的 content div，
   * `view-class="h-full"` 会因此量不到高度；补成撑满可视高度。
   *
   * 同一层还带着 reka 的内联 `min-width: fit-content`（开着横向滚动时写上去的），
   * 于是"内容盒至少和内容一样宽"：页面里 `w-full` 的元素会被临时超宽的内容
   * （大屏的 1920、宽表格）顶开，`clientWidth` 不再是可视宽度 —— 按它算尺寸的
   * 逻辑全部失真（大屏缩放因此永远不缩，右侧整列被裁掉）。
   * 这里钉回容器宽度：内容更宽时照样溢出到 viewport 上滚，横向滚动条不受影响。
   * 内联样式只能以 important 顶掉。
   */
  .scrollbar__area [data-reka-scroll-area-viewport] > div {
    height: 100%;
    min-width: 100% !important;
  }
}
</style>
