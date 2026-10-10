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

  /** 指针按下时的起点，尚未越过阈值前只叫「预备」，不算拖拽 */
  let pending: undefined | { pointerId: number; startX: number; startScrollLeft: number };
  let observer: ResizeObserver | undefined;
  /** 复位 justDragged 的那一帧，卸载时要取消，避免组件销毁后再写 ref */
  let dragRaf: number | undefined;

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

  /**
   * 指针按下：只做「预备」，**不**调用 setPointerCapture。
   *
   * 这是这里踩过的最大的一个坑：pointer capture 会把后续 `pointerup` 以及由它合成的
   * `click` 的 target 改写成「捕获元素」（也就是滚动容器本身）。antd Menu 的 onClick
   * 绑在每个 `<li>` 上，事件传播路径里一旦不再有 `<li>` 参与，点击就直接失效 ——
   * 表现是「用鼠标点一级导航没反应，但 `el.click()` 有效」，而且只在菜单真的溢出时出现
   * （没溢出时下面的 guard 会提前 return，不进入拖拽流程）。
   * 所以捕获推迟到确认越过阈值之后，见 onWindowPointerMove。
   */
  function onPointerDown(event: PointerEvent) {
    if (!draggable || event.button !== 0) return;
    const node = el();
    if (!node || node.scrollWidth <= node.clientWidth) return;
    pending = {
      pointerId: event.pointerId,
      startX: event.pageX,
      startScrollLeft: node.scrollLeft,
    };
    isDragging.value = false;
    // 绑在 window 上：指针滑出容器后仍能继续跟手，松开也能收尾（不会卡在拖拽态）
    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerUp);
  }

  function onWindowPointerMove(event: PointerEvent) {
    if (!pending) return;
    const node = el();
    if (!node) return;
    const distance = Math.abs(event.pageX - pending.startX);
    if (distance < DRAG_THRESHOLD) return;
    if (!isDragging.value) {
      isDragging.value = true;
      // 已经确认是拖拽，此时吃掉紧随其后的 click 反而是想要的（见 onClickCapture）
      try {
        node.setPointerCapture?.(event.pointerId);
      } catch {
        // 指针已释放 / id 不合法：不影响拖拽，忽略
      }
    }
    node.scrollLeft = Math.max(0, pending.startScrollLeft - (event.pageX - pending.startX));
    update();
  }

  /** 把拖拽期间挂在 window 上的三个监听摘掉（幂等） */
  function detachWindowListeners() {
    window.removeEventListener('pointermove', onWindowPointerMove);
    window.removeEventListener('pointerup', onWindowPointerUp);
    window.removeEventListener('pointercancel', onWindowPointerUp);
  }

  function onWindowPointerUp(event: PointerEvent) {
    detachWindowListeners();
    const node = el();
    if (isDragging.value) {
      justDragged.value = true;
      // 下一帧清除，给紧随其后的 click 留出被拦截的时机（click 在 pointerup 之后、下一帧之前派发）
      if (dragRaf !== undefined) cancelAnimationFrame(dragRaf);
      dragRaf = requestAnimationFrame(() => {
        dragRaf = undefined;
        justDragged.value = false;
      });
      try {
        if (node?.hasPointerCapture?.(event.pointerId)) {
          node.releasePointerCapture(event.pointerId);
        }
      } catch {
        // 释放失败不影响状态复位
      }
    }
    isDragging.value = false;
    pending = undefined;
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
    // 拖拽中途卸载（切布局 / 路由销毁顶栏）时，window 上的监听必须摘掉，
    // 否则闭包会一直引用已卸载的 ref 并阻止容器被回收
    detachWindowListeners();
    if (dragRaf !== undefined) cancelAnimationFrame(dragRaf);
    dragRaf = undefined;
    pending = undefined;
    isDragging.value = false;
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
    onClickCapture,
  };
}
