import { createApp, defineComponent, h, shallowRef } from 'vue';

import { afterEach, describe, expect, it } from 'vitest';

import {
  computeOverflow,
  DRAG_THRESHOLD,
  dragWalk,
  pickHorizontalDelta,
  useHorizontalScroll,
} from '../src/utils/scroll';

/**
 * 横向滚动条逻辑的单测：标签条（tabs-ui）与顶部导航菜单（menu-ui）都跑这套，
 * 所以纯函数与 composable 各自单独验证，不依赖任何 ui-kit。
 */

describe('纯函数', () => {
  it('没有溢出时左右都不可滚', () => {
    expect(computeOverflow(0, 100, 100)).toEqual({
      canScrollLeft: false,
      canScrollRight: false,
      contentWidth: 100,
      viewportWidth: 100,
    });
  });

  it('中间位置两边都能滚，贴到两端只剩单侧', () => {
    expect(computeOverflow(100, 600, 400).canScrollLeft).toBe(true);
    expect(computeOverflow(100, 600, 400).canScrollRight).toBe(true);
    // 最大偏移 200，落在 0 与 200 时各关掉一个方向
    expect(computeOverflow(0, 600, 400).canScrollRight).toBe(true);
    expect(computeOverflow(200, 600, 400).canScrollRight).toBe(false);
    expect(computeOverflow(199, 600, 400).canScrollRight).toBe(false);
    expect(computeOverflow(200, 600, 400).canScrollLeft).toBe(true);
  });

  it('亚像素误差不算溢出（Safari / 缩放后 scrollWidth 常多出零点几像素）', () => {
    expect(computeOverflow(0, 402, 400).canScrollRight).toBe(false);
    expect(computeOverflow(2, 402, 400).canScrollLeft).toBe(false);
    expect(computeOverflow(3, 402, 400).canScrollLeft).toBe(true);
  });

  it('触控板横向手势优先，纯纵向滚轮才换算成横向，微量抖动忽略', () => {
    expect(pickHorizontalDelta(-120, 10)).toBe(-120);
    expect(pickHorizontalDelta(10, 60)).toBe(60);
    expect(pickHorizontalDelta(0, 0.6)).toBe(0);
  });

  it('拖拽位移默认反向跟手 1.5 倍', () => {
    expect(dragWalk(100, 80)).toBe(-30);
    expect(dragWalk(100, 110, 2)).toBe(20);
  });

  it('拖拽阈值存在且不为 0（否则点一下就被判成拖拽，点击全废）', () => {
    expect(DRAG_THRESHOLD).toBeGreaterThan(0);
  });
});

/**
 * 造一个"能量出溢出"的容器：happy-dom 不实现布局，scrollWidth/clientWidth 恒为 0，
 * 所以按测试需要把它们钉成定值，scrollLeft 与 scrollTo 用可写字段模拟。
 */
function fakeContainer(scrollWidth: number, clientWidth: number) {
  const node = document.createElement('div');
  let left = 0;
  const scrollToCalls: number[] = [];

  Object.defineProperty(node, 'scrollWidth', {
    configurable: true,
    get: () => scrollWidth,
  });
  Object.defineProperty(node, 'clientWidth', {
    configurable: true,
    get: () => clientWidth,
  });
  Object.defineProperty(node, 'scrollLeft', {
    configurable: true,
    get: () => left,
    set: (value: number) => {
      left = value;
    },
  });
  node.scrollTo = ((options: { left: number }) => {
    scrollToCalls.push(options.left);
    left = options.left;
  }) as typeof node.scrollTo;

  return { left: () => left, node, scrollToCalls };
}

/**
 * shared 不装 @vue/test-utils（这层没有组件要测），所以直接用一个宿主组件把
 * composable 挂起来，好让 onMounted / onBeforeUnmount 真的跑：溢出计算与
 * 窗口监听摘除都挂在这两个钩子上，脱离组件调用测不到。
 */
function setupScroll(
  scrollWidth: number,
  clientWidth: number,
  options?: Parameters<typeof useHorizontalScroll>[1],
) {
  const container = fakeContainer(scrollWidth, clientWidth);
  let api!: ReturnType<typeof useHorizontalScroll>;

  const app = createApp(
    defineComponent({
      setup() {
        api = useHorizontalScroll(
          shallowRef<HTMLElement | undefined>(container.node),
          options,
        );
        return () => h('div');
      },
    }),
  );
  app.mount(document.createElement('div'));

  return { api, container, unmount: () => app.unmount() };
}

const pointerEvent = (type: string, init: Record<string, unknown>) =>
  Object.assign(
    new Event(type, { bubbles: true, cancelable: true }),
    init,
  ) as unknown as MouseEvent & PointerEvent & WheelEvent;

/** 每个用例挂起来的宿主，收尾时统一卸载（窗口监听的摘除也是被测行为） */
const mounted: Array<() => void> = [];

function setup(
  scrollWidth: number,
  clientWidth: number,
  options?: Parameters<typeof useHorizontalScroll>[1],
) {
  const harness = setupScroll(scrollWidth, clientWidth, options);
  mounted.push(harness.unmount);
  return harness;
}

afterEach(() => {
  mounted.splice(0).forEach((unmount) => unmount());
});

describe('useHorizontalScroll', () => {
  it('挂载时算一次溢出状态', () => {
    const { api } = setup(600, 400, { step: 120 });
    expect(api.canScrollLeft.value).toBe(false);
    expect(api.canScrollRight.value).toBe(true);

    // 滚到中间（最大偏移 200），两侧都能再滚
    api.scrollByStep(1);
    api.update();
    expect(api.canScrollLeft.value).toBe(true);
    expect(api.canScrollRight.value).toBe(true);

    // 再滚一次到底，右侧箭头就该收起
    api.scrollByStep(1);
    api.update();
    expect(api.canScrollRight.value).toBe(false);
  });

  it('箭头按 step 位移，双击滚到端点', () => {
    const { api, container } = setup(600, 400, { step: 120 });
    api.scrollByStep(1);
    expect(container.left()).toBe(120);
    api.scrollByStep(-1);
    expect(container.left()).toBe(0);

    api.scrollByStep(1);
    api.scrollToEnd(1);
    expect(container.left()).toBe(600);
    api.scrollToEnd(-1);
    expect(container.left()).toBe(0);
  });

  it('溢出时接管滚轮，没溢出时放行给页面', () => {
    const overflow = setup(600, 400);
    const wheel = pointerEvent('wheel', { deltaX: 0, deltaY: 50 });
    overflow.api.onWheel(wheel);
    expect(wheel.defaultPrevented).toBe(true);
    expect(overflow.container.left()).toBe(50);

    const tight = setup(300, 400);
    const pass = pointerEvent('wheel', { deltaX: 0, deltaY: 50 });
    tight.api.onWheel(pass);
    expect(pass.defaultPrevented).toBe(false);
  });

  it('拖拽跟手：越过阈值才认定拖拽，内容反向跟随指针且不为负', () => {
    const { api, container } = setup(600, 400);

    // 消费方把 onPointerDown 绑在容器上，这里按同样的方式调用
    api.onPointerDown(
      pointerEvent('pointerdown', { button: 0, pageX: 300, pointerId: 1 }),
    );
    expect(api.isDragging.value).toBe(false);

    // 阈值内的抖动不算拖拽
    window.dispatchEvent(
      pointerEvent('pointermove', {
        pageX: 300 + DRAG_THRESHOLD - 1,
        pointerId: 1,
      }),
    );
    expect(api.isDragging.value).toBe(false);

    window.dispatchEvent(
      pointerEvent('pointermove', { pageX: 200, pointerId: 1 }),
    );
    expect(api.isDragging.value).toBe(true);
    expect(container.left()).toBe(100);

    // 往右拖到底，scrollLeft 不能被写成负数
    window.dispatchEvent(
      pointerEvent('pointermove', { pageX: 800, pointerId: 1 }),
    );
    expect(container.left()).toBe(0);

    window.dispatchEvent(pointerEvent('pointerup', { pointerId: 1 }));
    expect(api.isDragging.value).toBe(false);
  });

  it('拖完那一次 click 被吞掉，之后的点击恢复正常', () => {
    const { api } = setup(600, 400);
    api.onPointerDown(
      pointerEvent('pointerdown', { button: 0, pageX: 300, pointerId: 1 }),
    );
    window.dispatchEvent(
      pointerEvent('pointermove', { pageX: 260, pointerId: 1 }),
    );
    window.dispatchEvent(pointerEvent('pointerup', { pointerId: 1 }));

    const swallowed = pointerEvent('click', {});
    api.onClickCapture(swallowed);
    expect(swallowed.defaultPrevented).toBe(true);

    const normal = pointerEvent('click', {});
    api.onClickCapture(normal);
    expect(normal.defaultPrevented).toBe(false);
  });

  it('draggable 关掉后指针不产生拖拽；右键也不参与', () => {
    const { api } = setup(600, 400, { draggable: false });
    api.onPointerDown(
      pointerEvent('pointerdown', { button: 0, pageX: 300, pointerId: 1 }),
    );
    window.dispatchEvent(
      pointerEvent('pointermove', { pageX: 100, pointerId: 1 }),
    );
    expect(api.isDragging.value).toBe(false);

    const drag = setup(600, 400);
    drag.api.onPointerDown(
      pointerEvent('pointerdown', { button: 2, pageX: 300, pointerId: 2 }),
    );
    window.dispatchEvent(
      pointerEvent('pointermove', { pageX: 100, pointerId: 2 }),
    );
    expect(drag.api.isDragging.value).toBe(false);
  });

  it('没溢出的容器不进入拖拽（点标签不该把标签条拖走）', () => {
    const { api, container } = setup(300, 400);
    api.onPointerDown(
      pointerEvent('pointerdown', { button: 0, pageX: 300, pointerId: 1 }),
    );
    window.dispatchEvent(
      pointerEvent('pointermove', { pageX: 100, pointerId: 1 }),
    );
    expect(api.isDragging.value).toBe(false);
    expect(container.left()).toBe(0);
  });

  it('把选中项滚进可视区，只在真的看不见时动', () => {
    const { api, container } = setup(600, 400);
    const item = document.createElement('div');
    item.setAttribute('data-scroll-key', 'b');
    // offsetLeft/offsetWidth 在 happy-dom 里同样是 0，钉成"看得见"的位置
    Object.defineProperty(item, 'offsetLeft', {
      configurable: true,
      get: () => 50,
    });
    Object.defineProperty(item, 'offsetWidth', {
      configurable: true,
      get: () => 100,
    });
    container.node.append(item);

    api.scrollKeyIntoView('b');
    expect(container.scrollToCalls).toEqual([]);

    Object.defineProperty(item, 'offsetLeft', {
      configurable: true,
      get: () => 500,
    });
    api.scrollKeyIntoView('b');
    expect(container.scrollToCalls).toEqual([500 + 100 - 400 + 16]);

    // 找不到的 key 不应抛错也不应滚动
    api.scrollKeyIntoView('missing');
    api.scrollKeyIntoView('');
    expect(container.scrollToCalls).toHaveLength(1);
  });

  it('卸载后不再响应窗口上的指针事件', () => {
    const { api, container, unmount } = setup(600, 400);
    api.onPointerDown(
      pointerEvent('pointerdown', { button: 0, pageX: 300, pointerId: 1 }),
    );
    unmount();
    mounted.length = 0;

    expect(() =>
      window.dispatchEvent(
        pointerEvent('pointermove', { pageX: 100, pointerId: 1 }),
      ),
    ).not.toThrow();
    expect(api.isDragging.value).toBe(false);
    expect(container.left()).toBe(0);
  });
});
