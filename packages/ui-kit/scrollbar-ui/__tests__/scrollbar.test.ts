import { nextTick } from 'vue';

import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Scrollbar from '../src/Scrollbar.vue';

/**
 * jsdom 不做布局，`clientHeight / scrollHeight` 恒为 0，
 * `update()` 会在"量不到尺寸"时早退 —— 所以溢出判定必须手动喂假尺寸。
 */
function stubBox(
  el: Element | null,
  box: {
    clientHeight: number;
    clientWidth: number;
    scrollHeight: number;
    scrollWidth: number;
  },
) {
  if (!el) throw new Error('找不到 .scrollbar__wrap，无法注入假尺寸');
  for (const [key, value] of Object.entries(box)) {
    Object.defineProperty(el, key, { configurable: true, get: () => value });
  }
}

const OVERFLOW_Y = {
  clientHeight: 100,
  clientWidth: 200,
  scrollHeight: 200,
  scrollWidth: 200,
};
const OVERFLOW_X = {
  clientHeight: 100,
  clientWidth: 200,
  scrollHeight: 100,
  scrollWidth: 400,
};
const FIT = {
  clientHeight: 100,
  clientWidth: 200,
  scrollHeight: 100,
  scrollWidth: 200,
};

async function mountScrollbar(
  props: Record<string, any> = {},
  box: Parameters<typeof stubBox>[1] = OVERFLOW_Y,
) {
  const wrapper = mount(Scrollbar, {
    props: { always: true, ...props },
    slots: { default: '<div class="content">内容</div>' },
  });
  stubBox(wrapper.find('.scrollbar__wrap').element, box);
  (wrapper.vm as any).update();
  // update() 只改状态，轨道是 v-if 出来的，断言前得让 DOM 追上来
  await nextTick();
  return wrapper;
}

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('Scrollbar 渲染模式', () => {
  it('native 模式不画自绘轨道，也不隐藏系统滚动条', async () => {
    const wrapper = await mountScrollbar({ always: false, native: true });
    expect(wrapper.find('.scrollbar__bar').exists()).toBe(false);
    expect(wrapper.find('.scrollbar__wrap').classes()).not.toContain(
      'scrollbar__wrap--hidden-default',
    );
  });

  it('自绘模式下隐藏系统滚动条', async () => {
    const wrapper = await mountScrollbar();
    expect(wrapper.find('.scrollbar__wrap').classes()).toContain(
      'scrollbar__wrap--hidden-default',
    );
  });

  it('内容放得下时一条轨道都不渲染', async () => {
    const wrapper = await mountScrollbar({}, FIT);
    expect(wrapper.find('.is-vertical').exists()).toBe(false);
    expect(wrapper.find('.is-horizontal').exists()).toBe(false);
  });

  it('纵向溢出只出现纵向轨道，thumb 高度按可视比例算', async () => {
    const wrapper = await mountScrollbar({}, OVERFLOW_Y);
    expect(wrapper.find('.is-vertical').exists()).toBe(true);
    expect(wrapper.find('.is-horizontal').exists()).toBe(false);
    expect(wrapper.find('.is-vertical .scrollbar__thumb').attributes('style')).toContain(
      'height: 50%',
    );
  });

  it('横向溢出只出现横向轨道', async () => {
    const wrapper = await mountScrollbar({}, OVERFLOW_X);
    expect(wrapper.find('.is-horizontal').exists()).toBe(true);
    expect(wrapper.find('.is-vertical').exists()).toBe(false);
  });

  it('thumb 有下限，极长列表不会缩成一像素', async () => {
    const wrapper = await mountScrollbar(
      { minSize: 20 },
      { ...OVERFLOW_Y, scrollHeight: 10_000 },
    );
    expect(wrapper.find('.scrollbar__thumb').attributes('style')).toContain(
      'height: 20%',
    );
  });

  it('view 用 tag 指定的标签渲染 slot', async () => {
    const wrapper = await mountScrollbar({ tag: 'ul' }, FIT);
    expect(wrapper.find('ul.scrollbar__view').exists()).toBe(true);
    expect(wrapper.find('.content').text()).toBe('内容');
  });
});

describe('可见性与滚动事件', () => {
  it('always 时轨道常驻', async () => {
    const wrapper = await mountScrollbar({ always: true });
    expect(wrapper.find('.is-vertical').classes()).toContain('opacity-100');
  });

  it('滚动后出现轨道，停止 hideDelay 之后淡出', async () => {
    vi.useFakeTimers();
    const wrapper = await mountScrollbar({ always: false, hideDelay: 800 });
    // 溢出判定通过才有轨道；此时既没滚动也没悬停 → 隐藏
    await wrapper.find('.scrollbar__wrap').trigger('scroll');
    expect(wrapper.find('.is-vertical').classes()).toContain('opacity-100');

    vi.advanceTimersByTime(801);
    await nextTick();
    expect(wrapper.find('.is-vertical').classes()).toContain('opacity-0');
    expect(wrapper.find('.is-vertical').classes()).toContain(
      'pointer-events-none',
    );
  });

  it('scroll 事件带出滚动位置', async () => {
    const wrapper = await mountScrollbar({ always: false });
    const wrapEl = wrapper.find('.scrollbar__wrap').element as HTMLElement;
    wrapEl.scrollTop = 40;
    await wrapper.find('.scrollbar__wrap').trigger('scroll');

    const payload = wrapper.emitted('scroll')?.at(-1)?.[0] as {
      scrollTop: number;
    };
    expect(payload.scrollTop).toBe(40);
    // 位移按 clientHeight 归一成百分比，供 thumb 的 translate 使用
    expect(
      (wrapper.find('.is-vertical .scrollbar__thumb').element as HTMLElement)
        .style.transform,
    ).toBe('translateY(40%)');
  });
});

describe('对外 API', () => {
  it('setScrollTop / setScrollLeft 拒绝 NaN，避免"以为滚回去了"', async () => {
    const wrapper = await mountScrollbar({}, OVERFLOW_Y);
    const vm = wrapper.vm as any;
    const wrapEl = wrapper.find('.scrollbar__wrap').element as HTMLElement;

    vm.setScrollTop(60);
    expect(wrapEl.scrollTop).toBe(60);

    vm.setScrollTop(Number.NaN);
    expect(wrapEl.scrollTop).toBe(60);

    vm.setScrollLeft(25);
    expect(wrapEl.scrollLeft).toBe(25);
    vm.setScrollLeft(Number.POSITIVE_INFINITY);
    expect(wrapEl.scrollLeft).toBe(25);
  });

  it('scrollTo 透传给滚动容器', async () => {
    const wrapper = await mountScrollbar({}, OVERFLOW_Y);
    const wrapEl = wrapper.find('.scrollbar__wrap').element as HTMLElement;
    const scrollTo = vi.fn();
    wrapEl.scrollTo = scrollTo;

    (wrapper.vm as any).scrollTo({ left: 10, top: 20 });
    expect(scrollTo).toHaveBeenCalledWith({ left: 10, top: 20 });
  });

  it('maxHeight 走按窗口高度缩放的响应式上限', async () => {
    // jsdom 视口高 768：495 × (768/1080)^1.938 ≈ 265，被下限 712 兜住
    const wrapper = await mountScrollbar({ maxHeight: 495 }, OVERFLOW_Y);
    expect(wrapper.find('.group\\/scrollbar').attributes('style')).toContain(
      'max-height: 712px',
    );
  });
});
