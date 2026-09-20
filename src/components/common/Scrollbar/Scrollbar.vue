<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";

import type { ScrollbarInstance, ScrollbarPosition, ScrollbarProps } from "./types";

import { cn } from "~/utils/cn";
const props = withDefaults(defineProps<ScrollbarProps>(), {
  native: false,
  always: false,
  minSize: 20,
  barWidth: 6,
  smooth: true,
  noHorizontal: false,
  noVertical: false,
  tag: "div",
});
const emit = defineEmits<{
  (e: "scroll", position: ScrollbarPosition, event: Event): void;
}>();
const DESIGN_BASE_WIDTH = 1920;
const scaleRatio = ref(1);
/* ============ refs ============ */
const containerRef = shallowRef<HTMLElement | null>(null);
const wrapRef = shallowRef<HTMLElement | null>(null);
const trackVerticalRef = shallowRef<HTMLElement | null>(null);
const trackHorizontalRef = shallowRef<HTMLElement | null>(null);

/* ============ state ============ */
const visibleVertical = ref(false);
const visibleHorizontal = ref(false);
const thumbVerticalHeight = ref(0);
const thumbVerticalTop = ref(0);
const thumbHorizontalWidth = ref(0);
const thumbHorizontalLeft = ref(0);

/** 鼠标是否在容器内 */
const isHovering = ref(false);

const isDraggingVertical = ref(false);
const isDraggingHorizontal = ref(false);
const dragStartY = ref(0);
const dragStartX = ref(0);
const dragStartScrollTop = ref(0);
const dragStartScrollLeft = ref(0);

/* ============ utils ============ */
function toCssSize(value?: string | number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return `${value}px`;
  if (/^\d+(\.\d+)?$/.test(value)) return `${value}px`;
  return value;
}
function computeScaleRatio(): number {
  if (typeof window === "undefined" || !window.screen?.width) return 1;
  return window.screen.width / DESIGN_BASE_WIDTH;
}
function scaleSize(value: string | number | undefined, ratio: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;

  // 不缩放
  if (ratio === 1) return toCssSize(value);

  // 数字 / 数字字符串 → px 缩放
  if (typeof value === "number") return `${value * ratio}px`;
  if (/^\d+(\.\d+)?$/.test(value)) return `${parseFloat(value) * ratio}px`;

  // 明确 px → 缩放
  const pxMatch = value.match(/^(\d+(?:\.\d+)?)px$/);
  if (pxMatch) return `${parseFloat(pxMatch?.[1]!) * ratio}px`;

  // 其它单位（vh/vw/rem/em/%）原样返回
  return value;
}
/* ============ 容器样式 ============ */
const containerStyle = computed<Record<string, string>>(() => {
  const style: Record<string, string> = {};
  const h = scaleSize(props.height, scaleRatio.value);
  const mh = scaleSize(props.maxHeight, scaleRatio.value);
  if (h) style.height = h;
  if (mh) style.maxHeight = mh;
  return { ...style, ...(props.wrapStyle as Record<string, string> | undefined) };
});

/**
 * 外层容器：
 *   flex flex-col          → 让内层 flex-1 生效
 *   h-full max-h-full      → 高度撑满父级 / 被父级 max-height 限制
 *   min-h-0                → 作为 flex item 时可被压缩（关键）
 *   overflow-hidden        → 裁掉溢出的滚动条
 */
const containerClass = computed(() =>
  cn("scrollbar pb-6 relative flex flex-col overflow-hidden", "h-full max-h-full min-h-0"),
);

/** 滚动容器：这里才应用 wrapClass */
const wrapClass = computed(() => {
  const base = cn("scrollbar__wrap flex-1 min-h-0 w-full");

  const overflow = cn(
    props.noHorizontal ? "overflow-x-hidden" : "overflow-x-auto",
    props.noVertical ? "overflow-y-hidden" : "overflow-y-auto",
  );

  const hideNative = props.native
    ? ""
    : "[&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]";

  return cn(base, overflow, hideNative, props.wrapClass);
});

const viewClass = computed(() => cn("scrollbar__view min-w-full", props.viewClass));

/* ============ 显隐控制（核心） ============ */
/**
 * 垂直滚动条显隐：
 *   - native 模式 / noVertical → 永不显示
 *   - always → 永远显示
 *   - hover / dragging → 显示
 *   - 其余 → 隐藏（但仍占位，加 pointer-events-none 防止误点）
 */
const showVertical = computed(
  () =>
    !props.native &&
    !props.noVertical &&
    visibleVertical.value &&
    (props.always || isHovering.value || isDraggingVertical.value),
);

const showHorizontal = computed(
  () =>
    !props.native &&
    !props.noHorizontal &&
    visibleHorizontal.value &&
    (props.always || isHovering.value || isDraggingHorizontal.value),
);

/* ============ 轨道 / thumb 样式 ============ */
const trackBaseClass =
  "scrollbar__bar absolute z-10 transition-opacity duration-200 hover:!bg-[rgba(144,147,153,0.1)]";

const trackVerticalClass = computed(() =>
  cn(trackBaseClass, "scrollbar__bar--vertical top-0 right-0 bottom-0"),
);

const trackHorizontalClass = computed(() =>
  cn(trackBaseClass, "scrollbar__bar--horizontal left-0 right-0 bottom-0"),
);

/** 轨道必须带 width / height，否则宽度为 0 看不见 */
const trackVerticalStyle = computed(() => ({
  width: `${props.barWidth}px`,
  backgroundColor: props.trackColor || "transparent",
}));

const trackHorizontalStyle = computed(() => ({
  height: `${props.barWidth}px`,
  backgroundColor: props.trackColor || "transparent",
}));

const thumbVerticalStyle = computed(() => ({
  width: `${props.barWidth}px`,
  height: `${thumbVerticalHeight.value}px`,
  top: `${thumbVerticalTop.value}px`,
  backgroundColor: props.thumbColor || "rgba(144, 147, 153, 0.3)",
  borderRadius: `${(props.barWidth ?? 6) / 2}px`,
}));

const thumbHorizontalStyle = computed(() => ({
  height: `${props.barWidth}px`,
  width: `${thumbHorizontalWidth.value}px`,
  left: `${thumbHorizontalLeft.value}px`,
  backgroundColor: props.thumbColor || "rgba(144, 147, 153, 0.3)",
  borderRadius: `${(props.barWidth ?? 6) / 2}px`,
}));

/* ============ 核心 update ============ */
function update() {
  const wrap = wrapRef.value;
  if (!wrap || props.native) return;

  const { scrollHeight, clientHeight, scrollWidth, clientWidth, scrollTop, scrollLeft } = wrap;

  // ---------- 垂直 ----------
  if (!props.noVertical && scrollHeight > clientHeight) {
    visibleVertical.value = true;
    const thumbHeight = Math.max((clientHeight / scrollHeight) * clientHeight, props.minSize!);
    thumbVerticalHeight.value = thumbHeight;

    const maxScrollTop = scrollHeight - clientHeight;
    const maxThumbTop = clientHeight - thumbHeight;
    thumbVerticalTop.value = maxScrollTop > 0 ? (scrollTop / maxScrollTop) * maxThumbTop : 0;
  } else {
    visibleVertical.value = false;
    thumbVerticalTop.value = 0;
  }

  // ---------- 水平 ----------
  if (!props.noHorizontal && scrollWidth > clientWidth) {
    visibleHorizontal.value = true;
    const thumbWidth = Math.max((clientWidth / scrollWidth) * clientWidth, props.minSize!);
    thumbHorizontalWidth.value = thumbWidth;

    const maxScrollLeft = scrollWidth - clientWidth;
    const maxThumbLeft = clientWidth - thumbWidth;
    thumbHorizontalLeft.value = maxScrollLeft > 0 ? (scrollLeft / maxScrollLeft) * maxThumbLeft : 0;
  } else {
    visibleHorizontal.value = false;
    thumbHorizontalLeft.value = 0;
  }
}

/* ============ 事件 ============ */
function handleScroll(e: Event) {
  const wrap = wrapRef.value;
  if (!wrap) return;
  update();
  emit("scroll", { scrollTop: wrap.scrollTop, scrollLeft: wrap.scrollLeft }, e);
}

function handleVerticalTrackClick(e: MouseEvent) {
  const wrap = wrapRef.value;
  const track = trackVerticalRef.value;
  if (!wrap || !track) return;

  const rect = track.getBoundingClientRect();
  const offsetY = e.clientY - rect.top;
  const movable = rect.height - thumbVerticalHeight.value;
  if (movable <= 0) return;

  const ratio = (offsetY - thumbVerticalHeight.value / 2) / movable;
  const maxScrollTop = wrap.scrollHeight - wrap.clientHeight;
  wrap.scrollTop = Math.max(0, Math.min(ratio * maxScrollTop, maxScrollTop));
}

function handleHorizontalTrackClick(e: MouseEvent) {
  const wrap = wrapRef.value;
  const track = trackHorizontalRef.value;
  if (!wrap || !track) return;

  const rect = track.getBoundingClientRect();
  const offsetX = e.clientX - rect.left;
  const movable = rect.width - thumbHorizontalWidth.value;
  if (movable <= 0) return;

  const ratio = (offsetX - thumbHorizontalWidth.value / 2) / movable;
  const maxScrollLeft = wrap.scrollWidth - wrap.clientWidth;
  wrap.scrollLeft = Math.max(0, Math.min(ratio * maxScrollLeft, maxScrollLeft));
}

/* --- 垂直拖拽 --- */
function startDragVertical(e: MouseEvent) {
  e.stopPropagation();
  e.preventDefault();
  isDraggingVertical.value = true;
  dragStartY.value = e.clientY;
  dragStartScrollTop.value = wrapRef.value?.scrollTop || 0;
  document.addEventListener("mousemove", handleDragVertical);
  document.addEventListener("mouseup", stopDragVertical);
  document.body.style.userSelect = "none";
}

function handleDragVertical(e: MouseEvent) {
  const wrap = wrapRef.value;
  const track = trackVerticalRef.value;
  if (!isDraggingVertical.value || !wrap || !track) return;

  const movable = track.getBoundingClientRect().height - thumbVerticalHeight.value;
  if (movable <= 0) return;

  const deltaY = e.clientY - dragStartY.value;
  const maxScrollTop = wrap.scrollHeight - wrap.clientHeight;
  wrap.scrollTop = dragStartScrollTop.value + (deltaY / movable) * maxScrollTop;
}

function stopDragVertical() {
  isDraggingVertical.value = false;
  document.removeEventListener("mousemove", handleDragVertical);
  document.removeEventListener("mouseup", stopDragVertical);
  document.body.style.userSelect = "";
}

/* --- 水平拖拽 --- */
function startDragHorizontal(e: MouseEvent) {
  e.stopPropagation();
  e.preventDefault();
  isDraggingHorizontal.value = true;
  dragStartX.value = e.clientX;
  dragStartScrollLeft.value = wrapRef.value?.scrollLeft || 0;
  document.addEventListener("mousemove", handleDragHorizontal);
  document.addEventListener("mouseup", stopDragHorizontal);
  document.body.style.userSelect = "none";
}

function handleDragHorizontal(e: MouseEvent) {
  const wrap = wrapRef.value;
  const track = trackHorizontalRef.value;
  if (!isDraggingHorizontal.value || !wrap || !track) return;

  const movable = track.getBoundingClientRect().width - thumbHorizontalWidth.value;
  if (movable <= 0) return;

  const deltaX = e.clientX - dragStartX.value;
  const maxScrollLeft = wrap.scrollWidth - wrap.clientWidth;
  wrap.scrollLeft = dragStartScrollLeft.value + (deltaX / movable) * maxScrollLeft;
}

function stopDragHorizontal() {
  isDraggingHorizontal.value = false;
  document.removeEventListener("mousemove", handleDragHorizontal);
  document.removeEventListener("mouseup", stopDragHorizontal);
  document.body.style.userSelect = "";
}

/* ============ 实例方法 ============ */
const scrollTo: ScrollbarInstance["scrollTo"] = (options, y) => {
  if (!wrapRef.value) return;
  if (typeof options === "number" && typeof y === "number") {
    wrapRef.value.scrollTo(options, y);
  } else if (typeof options === "object") {
    wrapRef.value.scrollTo(options as ScrollToOptions);
  }
};

const setScrollTop: ScrollbarInstance["setScrollTop"] = (top) => {
  if (wrapRef.value) wrapRef.value.scrollTop = top;
};

const setScrollLeft: ScrollbarInstance["setScrollLeft"] = (left) => {
  if (wrapRef.value) wrapRef.value.scrollLeft = left;
};

const getWrapRef: ScrollbarInstance["getWrapRef"] = () => wrapRef.value;

/* ============ 生命周期 ============ */
let resizeObserver: ResizeObserver | null = null;
function handleWindowResize() {
  scaleRatio.value = computeScaleRatio();
}
onMounted(() => {
  scaleRatio.value = computeScaleRatio();
  nextTick(update);

  // ② 监听窗口/分辨率变化
  window.addEventListener("resize", handleWindowResize);

  // ③ 原有 ResizeObserver 保留
  if (window.ResizeObserver) {
    resizeObserver = new ResizeObserver(() => nextTick(update));
    if (containerRef.value) resizeObserver.observe(containerRef.value);
    if (wrapRef.value) resizeObserver.observe(wrapRef.value);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleWindowResize);

  resizeObserver?.disconnect();
  resizeObserver = null;
  stopDragVertical();
  stopDragHorizontal();
});

defineExpose<ScrollbarInstance>({
  scrollTo,
  setScrollTop,
  setScrollLeft,
  update,
  getWrapRef,
});
</script>

<template>
  <div
    ref="containerRef"
    :class="containerClass"
    :style="containerStyle"
    @mouseenter="isHovering = true"
    @mouseleave="isHovering = false"
  >
    <!-- 滚动容器 -->
    <div
      ref="wrapRef"
      :class="wrapClass"
      :style="{ overflow: native ? 'auto' : undefined }"
      @scroll="handleScroll"
    >
      <component :is="tag" :class="viewClass">
        <slot />
      </component>
    </div>

    <!-- 垂直滚动条：hover / dragging 才显示 -->
    <div
      v-if="!native && !noVertical && visibleVertical"
      ref="trackVerticalRef"
      :class="[trackVerticalClass, showVertical ? 'opacity-100' : 'opacity-0 pointer-events-none']"
      :style="trackVerticalStyle"
      @click="handleVerticalTrackClick"
    >
      <div
        :class="
          cn(
            'scrollbar__thumb absolute right-0 cursor-pointer transition-colors',
            'hover:!bg-[rgba(144,147,153,0.5)]',
            isDraggingVertical && '!bg-[rgba(144,147,153,0.6)]',
          )
        "
        :style="thumbVerticalStyle"
        @mousedown="startDragVertical"
      />
    </div>

    <!-- 水平滚动条：hover / dragging 才显示 -->
    <div
      v-if="!native && !noHorizontal && visibleHorizontal"
      ref="trackHorizontalRef"
      :class="[
        trackHorizontalClass,
        showHorizontal ? 'opacity-100' : 'opacity-0 pointer-events-none',
      ]"
      :style="trackHorizontalStyle"
      @click="handleHorizontalTrackClick"
    >
      <div
        :class="
          cn(
            'scrollbar__thumb absolute bottom-0 cursor-pointer transition-colors',
            'hover:!bg-[rgba(144,147,153,0.5)]',
            isDraggingHorizontal && '!bg-[rgba(144,147,153,0.6)]',
          )
        "
        :style="thumbHorizontalStyle"
        @mousedown="startDragHorizontal"
      />
    </div>
  </div>
</template>
