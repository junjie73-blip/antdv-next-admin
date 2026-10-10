<script lang="ts" setup>
import type { ScrollbarProps } from './types';

import { computed, nextTick, onMounted, provide, ref, watch } from 'vue';

import {
  unrefElement,
  useElementHover,
  useEventListener,
  useRafFn,
  useResizeObserver,
  useTimeoutFn,
  useWindowSize,
} from '@vueuse/core';
import { clamp, isNumber } from 'es-toolkit';
import { projectConfig } from '~/config/project';

import Bar from './bar';
import { useResponsiveMaxHeight } from './useResponsiveMaxHeight';

defineOptions({ name: 'Scrollbar' });

const props = withDefaults(defineProps<ScrollbarProps>(), {
  native: () => projectConfig.scrollbar?.native ?? false,
  wrapStyle: '',
  wrapClass: '',
  viewClass: '',
  viewStyle: '',
  noresize: false,
  tag: 'div',
  always: false,
  minSize: 20,
  scrollHeight: 0,
  maxHeight: undefined,
  rootClass: undefined,
  hideDelay: 800,
});

const emit = defineEmits<{
  (e: 'scroll', payload: { scrollTop: number; scrollLeft: number }): void;
}>();

const responsiveMaxHeight = useResponsiveMaxHeight({
  referenceMaxHeight: () => (isNumber(props.maxHeight) ? props.maxHeight : 495),
});

const sizeWidth = ref('0');
const sizeHeight = ref('0');
const moveX = ref(0);
const moveY = ref(0);
const wrap = ref<HTMLElement>();
const resize = ref<HTMLElement>();
const rootRef = ref<HTMLElement>();

/* ⭐ 新增：方向可见性状态 */
const hasVertical = ref(false);
const hasHorizontal = ref(false);

provide('scroll-bar-wrap', wrap);

const customScrollbarEnabled = computed(() => !props.native);

/* ============================================================
 * 滚动条可见性（显示逻辑不变）
 * ============================================================ */
const isScrolling = ref(false);
const isHovering = useElementHover(rootRef);

const { start: scheduleHide, stop: cancelHide } = useTimeoutFn(
  () => {
    isScrolling.value = false;
  },
  () => props.hideDelay,
  { immediate: false },
);

const barVisible = computed(
  () => props.always || isScrolling.value || isHovering.value,
);

const barVisibleClass = computed(() =>
  barVisible.value ? 'opacity-100' : 'opacity-0 pointer-events-none',
);

/* ============================================================
 * 根容器样式
 * ============================================================ */
const rootStyle = computed<Record<string, string>>(() => {
  if (props.maxHeight == null) return {};
  return { maxHeight: responsiveMaxHeight.maxHeightPx.value };
});

/* ============================================================
 * 滚动处理
 * ============================================================ */
const handleScroll = () => {
  const el = unrefElement(wrap);
  if (!el) return;

  if (customScrollbarEnabled.value) {
    // 位移只在对应方向存在时才需要计算（省一次除法）
    if (hasVertical.value) {
      moveY.value = el.clientHeight
        ? (el.scrollTop * 100) / el.clientHeight
        : 0;
    }
    if (hasHorizontal.value) {
      moveX.value = el.clientWidth ? (el.scrollLeft * 100) / el.clientWidth : 0;
    }
  }

  if (!props.always) {
    isScrolling.value = true;
    cancelHide();
    scheduleHide();
  }

  emit('scroll', { scrollTop: el.scrollTop, scrollLeft: el.scrollLeft });
};

/* ============================================================
 * 尺寸计算
 * ============================================================
 * ⭐ 核心改动：
 *  - 只有 scrollHeight > clientHeight 时才认为需要垂直滚动条
 *  - 只有 scrollWidth  > clientWidth  时才认为需要水平滚动条
 *  - 状态变化触发模板 v-if，未使用的方向完全不渲染
 */
const update = () => {
  const el = unrefElement(wrap);
  if (!el) return;

  const { clientHeight, clientWidth, scrollHeight, scrollWidth } = el;
  if (!clientHeight || !clientWidth) return;
  if (!scrollHeight || !scrollWidth) return;

  const minSize = clamp(props.minSize, 0, 100);

  // ---------- 垂直 ----------
  if (scrollHeight > clientHeight) {
    hasVertical.value = true;
    const heightPercentage = (clientHeight * 100) / scrollHeight;
    sizeHeight.value = `${Math.max(heightPercentage, minSize)}%`;
  } else {
    hasVertical.value = false;
    sizeHeight.value = '0';
    moveY.value = 0;
  }

  // ---------- 水平 ----------
  if (scrollWidth > clientWidth) {
    hasHorizontal.value = true;
    const widthPercentage = (clientWidth * 100) / scrollWidth;
    sizeWidth.value = `${Math.max(widthPercentage, minSize)}%`;
  } else {
    hasHorizontal.value = false;
    sizeWidth.value = '0';
    moveX.value = 0;
  }
};

/* ============================================================
 * 监听
 * ============================================================ */
useEventListener(wrap, 'scroll', handleScroll, { passive: true });

const shouldObserveResize = () =>
  customScrollbarEnabled.value && !props.noresize;

useResizeObserver(wrap, () => {
  if (shouldObserveResize()) update();
});

useResizeObserver(resize, () => {
  if (shouldObserveResize()) update();
});

const { width: windowWidth, height: windowHeight } = useWindowSize();
watch([windowWidth, windowHeight], () => {
  if (shouldObserveResize()) update();
});

watch(
  () => props.scrollHeight,
  () => {
    if (!customScrollbarEnabled.value) return;
    update();
  },
);

/* ============================================================
 * 挂载后兜底重算
 * ============================================================ */
const safeUpdate = () => {
  if (!customScrollbarEnabled.value) return;
  try {
    update();
  } catch {
    /* noop */
  }
};

const { pause: pauseRaf, resume: resumeRaf } = useRafFn(
  () => {
    safeUpdate();
    pauseRaf();
  },
  { immediate: false },
);

const { start: startDelayedUpdate } = useTimeoutFn(safeUpdate, 50, {
  immediate: false,
});

onMounted(() => {
  if (!customScrollbarEnabled.value) return;
  nextTick(safeUpdate);
  resumeRaf();
  startDelayedUpdate();
});

/* ============================================================
 * 对外 API
 * ============================================================ */
const setScrollTop = (value: number) => {
  if (!isNumber(value)) return;
  const el = unrefElement(wrap);
  if (el) el.scrollTop = value;
};

const setScrollLeft = (value: number) => {
  if (!isNumber(value)) return;
  const el = unrefElement(wrap);
  if (el) el.scrollLeft = value;
};

const scrollTo = (options: ScrollToOptions) => {
  unrefElement(wrap)?.scrollTo(options);
};

defineExpose({
  wrap,
  update,
  setScrollTop,
  setScrollLeft,
  scrollTo,
  handleScroll,
});
</script>

<template>
  <div
    ref="rootRef"
    class="group/scrollbar relative flex min-h-0 flex-col overflow-hidden" :class="[
      rootClass ?? 'h-full',
    ]"
    :style="rootStyle"
  >
    <div
      ref="wrap"
      class="scrollbar__wrap min-h-0 w-full flex-1 overflow-auto" :class="[
        wrapClass,
        native ? '' : 'scrollbar__wrap--hidden-default',
      ]"
      :style="wrapStyle"
    >
      <component
        :is="tag"
        ref="resize"
        class="scrollbar__view" :class="[viewClass]"
        :style="viewStyle"
      >
        <slot></slot>
      </component>
    </div>

    <template v-if="!native">
      <Bar
        v-if="hasHorizontal"
        :move="moveX"
        :size="sizeWidth"
        class="scrollbar__bar is-horizontal" :class="[barVisibleClass]"
      />
      <Bar
        v-if="hasVertical"
        vertical
        :move="moveY"
        :size="sizeHeight"
        class="scrollbar__bar is-vertical" :class="[barVisibleClass]"
      />
    </template>
  </div>
</template>

<style scoped>
.scrollbar__bar {
  transition: opacity 300ms ease;
}
</style>
