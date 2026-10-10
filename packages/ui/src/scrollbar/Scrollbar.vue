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

import Bar from './bar';
import { useResponsiveMaxHeight } from './useResponsiveMaxHeight';

defineOptions({ name: 'Scrollbar' });

const props = withDefaults(defineProps<ScrollbarProps>(), {
  /**
   * 是否用浏览器原生滚动条。
   * 包里默认 false（自绘）；应用侧想把菜单/弹窗换成原生滚动条时，
   * 由调用方把自己的项目配置传进来，包本身不去读 app 配置。
   */
  native: false,
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
// 显式声明局部变量再返回：直接 `return {}` 会被 TS 推断成
// `{ maxHeight?: undefined }`，与 `Record<string, string>` 不兼容。
const rootStyle = computed<Record<string, string>>(() => {
  const style: Record<string, string> = {};
  if (props.maxHeight != null) {
    style.maxHeight = responsiveMaxHeight.maxHeightPx.value;
  }
  return style;
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
/**
 * `isNumber(NaN)` 为 true（typeof NaN === 'number'），所以还要排除非有限值：
 * 把 NaN 写进 scrollTop 会被浏览器静默变成 0，调用方以为"滚回去了"，排查很费劲。
 */
const isScrollValue = (value: number) => isNumber(value) && Number.isFinite(value);

const setScrollTop = (value: number) => {
  if (!isScrollValue(value)) return;
  const el = unrefElement(wrap);
  if (el) el.scrollTop = value;
};

const setScrollLeft = (value: number) => {
  if (!isScrollValue(value)) return;
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

<!--
  样式随组件走：抽包之前这些规则在应用的 var.css 里，
  组件一旦被别人直接引用就会变成一个"没有样式的空壳"。

  这里刻意不写 `@apply`：Tailwind v4 只在"能解析到主题入口"的样式文件里展开工具类，
  独立的 SFC style block 里没有 `@import 'tailwindcss'` / `@reference`，构建期会直接
  报 `Cannot apply unknown utility class`。所以把原来工具类对应的声明展开成等价的原生
  CSS —— 组件的样式也就不再依赖宿主的 Tailwind 配置。

  写在 @layer components 里是为了保持和 Tailwind 工具类的原有优先级 ——
  模板上的 `flex-1 / min-h-0` 属于 utilities 层，必须仍然能覆盖这里。
-->
<style>
@layer components {
  /* ---------- 容器 ---------- */
  /* 对应 relative h-full overflow-hidden（保留给宿主按类名定制的钩子） */
  .scrollbar {
    position: relative;
    overflow: hidden;
    height: 100%;
  }

  /* ---------- 滚动区 ---------- */
  /* 对应 h-full overflow-auto；模板里的 flex-1 / min-h-0 属于 utilities 层，优先级更高 */
  .scrollbar__wrap {
    overflow: auto;
    height: 100%;
  }

  .scrollbar__wrap--hidden-default {
    scrollbar-width: none;
  }

  /* 对应 hidden h-0 w-0 opacity-0：隐藏原生滚动条 */
  .scrollbar__wrap--hidden-default::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
    opacity: 0;
  }

  .scrollbar__view {
    /* 默认无样式，给 slot 内容保留 */
  }

  /* ---------- 滑块 ---------- */
  /* 对应 relative block h-0 w-0 cursor-pointer rounded-[inherit]
     bg-slate-400/30 transition-colors duration-300 hover:bg-slate-400/50 */
  .scrollbar__thumb {
    position: relative;
    display: block;
    width: 0;
    height: 0;
    cursor: pointer;
    border-radius: inherit;
    background-color: rgb(148 163 184 / 0.3);
    transition:
      color 0.3s ease,
      background-color 0.3s ease;
  }

  .scrollbar__thumb:hover {
    background-color: rgb(148 163 184 / 0.5);
  }

  /* ---------- 轨道 ---------- */
  /* 对应 absolute right-0.5 bottom-0.5 z-1 rounded */
  .scrollbar__bar {
    position: absolute;
    z-index: 1;
    right: 2px;
    bottom: 2px;
    border-radius: 0.25rem;
    transition: opacity 0.3s ease;
  }

  /* 纵向轨道：对应 top-0.5 w-1.5 */
  .scrollbar__bar.is-vertical {
    top: 2px;
    width: 6px;
  }

  .scrollbar__bar.is-vertical > div {
    width: 100%;
  }

  /* 横向轨道：对应 left-0.5 h-1.5 */
  .scrollbar__bar.is-horizontal {
    left: 2px;
    height: 6px;
  }

  .scrollbar__bar.is-horizontal > div {
    height: 100%;
  }

  /* ---------- 暗色适配 ---------- */
  /* 对应 bg-slate-500/35 hover:bg-slate-500/55 */
  .dark .scrollbar__thumb {
    background-color: rgb(100 116 139 / 0.35);
  }

  .dark .scrollbar__thumb:hover {
    background-color: rgb(100 116 139 / 0.55);
  }
}
</style>
