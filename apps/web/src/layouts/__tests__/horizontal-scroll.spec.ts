import type { DefineComponent } from 'vue';

import { mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';

import {
  computeOverflow,
  DRAG_THRESHOLD,
  dragWalk,
  pickHorizontalDelta,
  SCROLL_EPSILON,
  useHorizontalScroll,
} from '../composables/useHorizontalScroll';

type ScrollApi = ReturnType<typeof useHorizontalScroll>;

/* ============================================================
 * 纯函数
 * ============================================================ */

describe('useHorizontalScroll —— 溢出计算', () => {
  it('内容不超可视宽时两个方向都不可滚', () => {
    expect(computeOverflow(0, 200, 200)).toMatchObject({
      canScrollLeft: false,
      canScrollRight: false,
    });
  });

  it('最左端只能向右滚，最右端只能向左滚', () => {
    expect(computeOverflow(0, 1_000, 200)).toMatchObject({
      canScrollLeft: false,
      canScrollRight: true,
    });
    expect(computeOverflow(800, 1_000, 200)).toMatchObject({
      canScrollLeft: true,
      canScrollRight: false,
    });
  });

  it('亚像素误差在容差内视为已到底（Safari / 缩放场景）', () => {
    const state = computeOverflow(799, 1_000, 200);
    expect(1_000 - 200 - 799).toBeLessThan(SCROLL_EPSILON * 2);
    expect(state.canScrollRight).toBe(false);
  });
});

describe('useHorizontalScroll —— 滚轮输入折算', () => {
  it('触控板横向手势优先于纵向分量', () => {
    expect(pickHorizontalDelta(40, 10)).toBe(40);
  });

  it('纯纵向滚轮换算成横向位移', () => {
    expect(pickHorizontalDelta(0, 60)).toBe(60);
  });

  it('小于 1 的抖动忽略，避免滚动条乱跳', () => {
    expect(pickHorizontalDelta(0, 0.5)).toBe(0);
  });
});

describe('useHorizontalScroll —— 拖拽位移', () => {
  it('指针左右移动得到对应位移', () => {
    expect(dragWalk(100, 60, 1)).toBe(-40);
    expect(dragWalk(100, 140, 1)).toBe(40);
  });

  it('倍率作用于位移本身', () => {
    expect(dragWalk(0, -20, 1.5)).toBeCloseTo(-30);
  });
});

/* ============================================================
 * DOM 交互语义
 * ============================================================ */

interface ScrollProbe {
  releasePointerCapture: ReturnType<typeof vi.fn>;
  scrollTo: ReturnType<typeof vi.fn>;
  setPointerCapture: ReturnType<typeof vi.fn>;
}

/**
 * 把 jsdom 里恒为 0 的尺寸字段改成可控的假数据。
 * scrollLeft 定义成可读写属性，方便断言"拖拽是否真的改了滚动位置"；
 * scrollTo 在 jsdom 里是 not-implemented，必须换成记录调用的假实现。
 */
function makeScrollable(
  node: HTMLElement,
  opts: { clientWidth?: number; scrollLeft?: number; scrollWidth?: number } = {},
): ScrollProbe {
  const { clientWidth = 200, scrollWidth = 1_000, scrollLeft = 0 } = opts;
  Object.defineProperty(node, 'clientWidth', { configurable: true, value: clientWidth });
  Object.defineProperty(node, 'scrollWidth', { configurable: true, value: scrollWidth });

  let current = scrollLeft;
  Object.defineProperty(node, 'scrollLeft', {
    configurable: true,
    get: () => current,
    set: (value: number) => {
      current = value;
    },
  });

  const scrollTo = vi.fn((arg?: number | ScrollToOptions) => {
    current = typeof arg === 'number' ? arg : Number(arg?.left ?? current);
  });
  node.scrollTo = scrollTo as unknown as typeof node.scrollTo;

  const setPointerCapture = vi.fn();
  const releasePointerCapture = vi.fn();
  node.setPointerCapture = setPointerCapture as unknown as typeof node.setPointerCapture;
  node.releasePointerCapture =
    releasePointerCapture as unknown as typeof node.releasePointerCapture;
  Object.defineProperty(node, 'hasPointerCapture', {
    configurable: true,
    value: () => true,
  });

  return { releasePointerCapture, scrollTo, setPointerCapture };
}

/**
 * composable 内部用了 onMounted / onBeforeUnmount，必须在 setup 同期调用，
 * 所以借一个最小宿主组件拿到真实的组件生命周期。
 *
 * 宿主还按 HeaderMenu.vue 的方式把三个返回的处理器绑到容器上 ——
 * 否则测的就只是"函数能不能调"，而不是"模板接线对不对"。
 */
function mountHost(options?: Parameters<typeof useHorizontalScroll>[1]) {
  let api: ScrollApi | undefined;

  const Host: DefineComponent = defineComponent({
    setup() {
      const elRef = ref<HTMLElement | null>(null);
      api = useHorizontalScroll(elRef, options);
      return () =>
        h('div', {
          class: 'scroll-host',
          onClick: api?.onClickCapture,
          onPointerdown: api?.onPointerDown,
          onWheel: api?.onWheel,
          ref: elRef,
        });
    },
  });

  const wrapper = mount(Host, { attachTo: document.body });
  return {
    api: () => api as ScrollApi,
    container: wrapper.element as HTMLElement,
    wrapper,
  };
}

/**
 * jsdom 没有 PointerEvent 构造器。处理器只读 button / pageX / pointerId，
 * 用 MouseEvent 派发同名事件即可，后两个字段用 defineProperty 补上。
 */
function firePointer(
  target: EventTarget,
  type: string,
  init: { button?: number; pageX?: number; pointerId?: number } = {},
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.pageX ?? 0,
    button: init.button ?? 0,
  });
  Object.defineProperty(event, 'pageX', { configurable: true, value: init.pageX ?? 0 });
  Object.defineProperty(event, 'pointerId', { configurable: true, value: init.pointerId ?? 1 });
  target.dispatchEvent(event);
  return event;
}

describe('useHorizontalScroll —— 拖拽与点击共存', () => {
  /**
   * 回归用例：曾经一按下就 setPointerCapture，指针捕获会把随后合成的 click 的 target
   * 改写成滚动容器本身，而 antd Menu 的 onClick 绑在每个 li 上 —— 表现是
   * "鼠标点一级导航没反应，但 el.click() 有效"，且只在菜单真溢出时出现。
   * 所以捕获必须等到越过 DRAG_THRESHOLD 之后才发生。
   */
  it('未越过阈值前绝不捕获指针，普通点击不受影响', () => {
    const { api, container, wrapper } = mountHost();
    const probe = makeScrollable(container);

    firePointer(container, 'pointerdown', { pageX: 500 });
    expect(probe.setPointerCapture).not.toHaveBeenCalled();
    expect(api().isDragging.value).toBe(false);

    // 阈值内的抖动仍然不算拖拽
    firePointer(window, 'pointermove', { pageX: 500 + DRAG_THRESHOLD - 1 });
    expect(probe.setPointerCapture).not.toHaveBeenCalled();
    expect(api().isDragging.value).toBe(false);

    // 松手后的那一次点击必须原样放行
    firePointer(window, 'pointerup', { pageX: 500 + DRAG_THRESHOLD - 1 });
    expect(firePointer(container, 'click').defaultPrevented).toBe(false);

    wrapper.unmount();
  });

  it('越过阈值后才捕获，并按反向跟手滚动', () => {
    const { api, container, wrapper } = mountHost();
    const probe = makeScrollable(container, { scrollLeft: 100 });

    firePointer(container, 'pointerdown', { pointerId: 7, pageX: 500 });
    firePointer(window, 'pointermove', { pointerId: 7, pageX: 500 + DRAG_THRESHOLD });
    expect(probe.setPointerCapture).toHaveBeenCalledTimes(1);
    expect(api().isDragging.value).toBe(true);
    // 指针右移 → 内容左移（scrollLeft 变小）
    expect(container.scrollLeft).toBe(100 - DRAG_THRESHOLD);

    firePointer(window, 'pointerup', { pointerId: 7 });
    expect(probe.releasePointerCapture).toHaveBeenCalledWith(7);
    expect(api().isDragging.value).toBe(false);

    wrapper.unmount();
  });

  it('真拖拽之后的第一次 click 被丢弃，第二次恢复放行', () => {
    const { api, container, wrapper } = mountHost();
    makeScrollable(container);

    firePointer(container, 'pointerdown', { pageX: 500 });
    firePointer(window, 'pointermove', { pageX: 460 });
    firePointer(window, 'pointerup', { pageX: 460 });

    expect(firePointer(container, 'click').defaultPrevented).toBe(true);
    // 只吞一次，后续点击不受影响
    expect(firePointer(container, 'click').defaultPrevented).toBe(false);

    wrapper.unmount();
  });

  it('松手后监听器全部摘除：后续移动不再改动滚动位置', () => {
    const { api, container, wrapper } = mountHost();
    makeScrollable(container, { scrollLeft: 200 });

    firePointer(container, 'pointerdown', { pageX: 300 });
    firePointer(window, 'pointermove', { pageX: 280 });
    firePointer(window, 'pointerup', { pageX: 280 });

    const after = container.scrollLeft;
    firePointer(window, 'pointermove', { pageX: 10 });
    expect(container.scrollLeft).toBe(after);
    expect(api().isDragging.value).toBe(false);

    wrapper.unmount();
  });

  it('内容没溢出时不进入拖拽流程', () => {
    const { api, container, wrapper } = mountHost();
    const probe = makeScrollable(container, { clientWidth: 800, scrollWidth: 800 });

    firePointer(container, 'pointerdown', { pageX: 500 });
    firePointer(window, 'pointermove', { pageX: 200 });
    expect(probe.setPointerCapture).not.toHaveBeenCalled();
    expect(api().isDragging.value).toBe(false);

    wrapper.unmount();
  });

  it('非左键不触发拖拽', () => {
    const { api, container, wrapper } = mountHost();
    makeScrollable(container);

    firePointer(container, 'pointerdown', { button: 2, pageX: 500 });
    firePointer(window, 'pointermove', { pageX: 300 });
    expect(api().isDragging.value).toBe(false);

    wrapper.unmount();
  });

  it('draggable: false 时完全忽略指针事件', () => {
    const { api, container, wrapper } = mountHost({ draggable: false });
    const probe = makeScrollable(container);

    firePointer(container, 'pointerdown', { pageX: 500 });
    firePointer(window, 'pointermove', { pageX: 200 });
    expect(probe.setPointerCapture).not.toHaveBeenCalled();
    expect(api().isDragging.value).toBe(false);

    wrapper.unmount();
  });

  it('卸载时收尾：拖拽中途销毁组件不会留下 window 监听', () => {
    const { container, wrapper } = mountHost();
    makeScrollable(container, { scrollLeft: 300 });

    firePointer(container, 'pointerdown', { pageX: 500 });
    firePointer(window, 'pointermove', { pageX: 480 });
    const before = container.scrollLeft;

    wrapper.unmount();

    // 组件已销毁，此时 window 上的移动监听必须已经摘掉
    firePointer(window, 'pointermove', { pageX: 100 });
    expect(container.scrollLeft).toBe(before);
  });
});

describe('useHorizontalScroll —— 溢出状态与箭头滚动', () => {
  it('mount 后测到溢出，滚一步后左侧可回滚', () => {
    const { api, container, wrapper } = mountHost({ step: 120 });
    const probe = makeScrollable(container, { scrollLeft: 0 });

    // 假尺寸是挂载之后才装上的，显式重测一次；能读出溢出说明 containerRef 已正确绑定
    api().update();
    expect(api().canScrollRight.value).toBe(true);
    expect(api().canScrollLeft.value).toBe(false);

    api().scrollByStep(1);
    expect(probe.scrollTo).toHaveBeenCalledWith({ behavior: 'smooth', left: 120 });
    expect(container.scrollLeft).toBe(120);

    api().update();
    expect(api().canScrollLeft.value).toBe(true);

    wrapper.unmount();
  });

  it('scrollToEnd 向左回到 0、向右滚到内容末尾', () => {
    const { api, container, wrapper } = mountHost();
    makeScrollable(container, { scrollLeft: 400 });

    api().scrollToEnd(1);
    expect(container.scrollLeft).toBe(1_000);
    api().scrollToEnd(-1);
    expect(container.scrollLeft).toBe(0);

    wrapper.unmount();
  });

  it('纵向滚轮在可横向滚动时接管默认行为', () => {
    const { api, container, wrapper } = mountHost();
    makeScrollable(container, { scrollLeft: 0 });

    const wheel = new WheelEvent('wheel', { cancelable: true, deltaY: 80 });
    container.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
    expect(container.scrollLeft).toBe(80);

    api().update();
    wrapper.unmount();
  });

  it('不可滚时滚轮不接管，页面正常纵向滚动', () => {
    const { container, wrapper } = mountHost();
    makeScrollable(container, { clientWidth: 800, scrollWidth: 800 });

    const wheel = new WheelEvent('wheel', { cancelable: true, deltaY: 80 });
    container.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);

    wrapper.unmount();
  });
});
