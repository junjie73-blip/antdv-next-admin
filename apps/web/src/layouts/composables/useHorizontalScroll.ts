import type { Ref } from 'vue';

import { onBeforeUnmount, onMounted, ref } from 'vue';

/* ============================================================
 * 纯函数部分（可单测）
 * ============================================================ */

export interface ScrollOverflow {
  canScrollLeft: boolean;
  canScrollRight: boolean;
  /** 内容总宽 */
  contentWidth: number;
  /** 可视宽 */
  viewportWidth: number;
}

/** 容差：Safari/缩放后 clientWidth 与 scrollWidth 常有亚像素误差 */
export const SCROLL_EPSILON = 2;

export function computeOverflow(
  scrollLeft: number,
  scrollWidth: number,
  clientWidth: number,
): ScrollOverflow {
  const max = Math.max(0, scrollWidth - clientWidth);
  return {
    canScrollLeft: scrollLeft > SCROLL_EPSILON,
    canScrollRight: scrollLeft < max - SCROLL_EPSILON,
    contentWidth: scrollWidth,
    viewportWidth: clientWidth,
  };
}

/**
 * 把滚轮输入折算成横向位移。
 * 触控板横向手势（deltaX）优先；只有纯纵向滚轮才换算成横向滚动，
 * 否则在真机上会出现「横向滚动条自己跳」。
 */
export function pickHorizontalDelta(deltaX: number, deltaY: number): number {
  if (Math.abs(deltaX) > Math.abs(deltaY)) return deltaX;
  if (Math.abs(deltaY) < 1) return 0;
  return deltaY;
}

/** 拖拽位移换算：反向跟手（内容跟随指针） */
export function dragWalk(startX: number, currentX: number, factor = 1.5) {
  return (currentX - startX) * factor;
}

/** 超过该阈值才认定为拖拽，避免误伤点击 */
export const DRAG_THRESHOLD = 6;

/* ============================================================
 * composable
 * ============================================================ */

export interface UseHorizontalScrollOptions {
  /** 每次点击左右箭头滚动的距离 */
  step?: number;
  /** 是否启用鼠标拖拽横向滚动 */
  draggable?: boolean;
}

export function useHorizontalScroll(
  containerRef: Ref<HTMLElement | null | undefined>,
  options: UseHorizontalScrollOptions = {},
) {
  const { step = 200, draggable = true } = options;

  const canScrollLeft = ref(false);
  const canScrollRight = ref(false);
  const isDragging = ref(false);
  /** 刚完成一次拖拽：用于吞掉紧随其后的 click */
  const justDragged = ref(false);

  let startX = 0;
  let startScrollLeft = 0;
  let moved = 0;
  let observer: ResizeObserver | undefined;

  function el() {
    return containerRef.value ?? undefined;
  }

  function update() {
    const node = el();
    if (!node) return;
    const state = computeOverflow(
      node.scrollLeft,
      node.scrollWidth,
      node.clientWidth,
    );
    canScrollLeft.value = state.canScrollLeft;
    canScrollRight.value = state.canScrollRight;
  }

  function scrollTo(offset: number, behavior: ScrollBehavior = 'smooth') {
    const node = el();
    if (!node) return;
    node.scrollTo({ left: offset, behavior });
  }

  function scrollByStep(direction: -1 | 1) {
    const node = el();
    if (!node) return;
    scrollTo(node.scrollLeft + direction * step);
  }

  function scrollToEnd(direction: -1 | 1) {
    const node = el();
    if (!node) return;
    const target = direction === -1 ? 0 : node.scrollWidth;
    scrollTo(target);
  }

  /** 让某个 key 的项进入可视区（选中态变化 / 新增标签时调用） */
  function scrollKeyIntoView(key?: string) {
    const node = el();
    if (!node || !key) return;
    const item = node.querySelector<HTMLElement>(`[data-scroll-key="${key}"]`);
    if (item) scrollElIntoView(item);
  }

  /**
   * antd Menu 不给单项加自定义属性，所以按渲染顺序定位。
   * 只取根菜单的直接子项，浮层里的子菜单不参与横向滚动。
   */
  function scrollIndexIntoView(index: number) {
    const node = el();
    if (!node || index < 0) return;
    const items = node.querySelectorAll<HTMLElement>(
      ':scope > .ant-menu-item, :scope > .ant-menu-submenu',
    );
    scrollElIntoView(items[index] ?? null);
  }

  function scrollElIntoView(item: HTMLElement | null) {
    const node = el();
    if (!node || !item) return;
    const { offsetLeft, offsetWidth } = item;
    const left = node.scrollLeft;
    const right = left + node.clientWidth;
    if (offsetLeft < left) scrollTo(offsetLeft - 16);
    else if (offsetLeft + offsetWidth > right)
      scrollTo(offsetLeft + offsetWidth - node.clientWidth + 16);
  }

  function onWheel(event: WheelEvent) {
    const node = el();
    if (!node) return;
    if (node.scrollWidth <= node.clientWidth) return;

    const delta = pickHorizontalDelta(event.deltaX, event.deltaY);
    if (!delta) return;
    // 横向可滚时接管纵向滚轮，否则页面在标签栏上滚不动
    event.preventDefault();
    scrollTo(node.scrollLeft + delta, 'auto');
  }

  function onPointerDown(event: PointerEvent) {
    if (!draggable || event.button !== 0) return;
    const node = el();
    if (!node || node.scrollWidth <= node.clientWidth) return;
    isDragging.value = true;
    justDragged.value = false;
    moved = 0;
    startX = event.pageX;
    startScrollLeft = node.scrollLeft;
    node.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    if (!isDragging.value) return;
    const node = el();
    if (!node) return;
    moved = Math.abs(event.pageX - startX);
    if (moved < DRAG_THRESHOLD) return;
    node.scrollLeft = Math.max(0, startScrollLeft - (event.pageX - startX));
    update();
  }

  function onPointerUp(event: PointerEvent) {
    const node = el();
    if (isDragging.value && moved >= DRAG_THRESHOLD) {
      justDragged.value = true;
      // 下一帧清除，给 click 事件留出被拦截的时机
      requestAnimationFrame(() => {
        justDragged.value = false;
      });
    }
    isDragging.value = false;
    node?.releasePointerCapture?.(event.pointerId);
  }

  /** 绑在容器上的 click 捕获：拖拽后的那一次 click 直接丢弃 */
  function onClickCapture(event: MouseEvent) {
    if (!justDragged.value) return;
    event.preventDefault();
    event.stopPropagation();
    justDragged.value = false;
  }

  function handleResize() {
    update();
  }

  onMounted(() => {
    update();
    window.addEventListener('resize', handleResize, { passive: true });
    const node = el();
    if (node && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(update);
      observer.observe(node);
    }
  });

  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize);
    observer?.disconnect();
    observer = undefined;
  });

  return {
    canScrollLeft,
    canScrollRight,
    isDragging,
    update,
    scrollByStep,
    scrollToEnd,
    scrollKeyIntoView,
    scrollIndexIntoView,
    scrollElIntoView,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onClickCapture,
  };
}
