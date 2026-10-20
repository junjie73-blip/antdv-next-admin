import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import Scrollbar from '../src/components/scrollbar/Scrollbar.vue';

const VIEWPORT = '[data-reka-scroll-area-viewport]';
const BAR = '[data-slot="scroll-area-scrollbar"]';

async function mountScrollbar(props: Record<string, any> = {}) {
  const wrapper = mount(Scrollbar, {
    props,
    slots: { default: '<div class="content">内容</div>' },
  });
  // 滚动盒在 onMounted 里等一次 nextTick 才解析出来
  await flushPromises();
  return wrapper;
}

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('渲染模式', () => {
  it('自绘模式的滚动盒就是 ScrollArea 的 viewport', async () => {
    const wrapper = await mountScrollbar();
    const wrap = wrapper.find('.scrollbar__wrap');
    expect(wrap.exists()).toBe(true);
    expect(wrap.element).toBe(wrapper.find(VIEWPORT).element);
  });

  it('native 模式不用 ScrollArea，把系统滚动条留给浏览器', async () => {
    const wrapper = await mountScrollbar({ native: true });
    expect(wrapper.find('.scrollbar__wrap').exists()).toBe(true);
    expect(wrapper.find(VIEWPORT).exists()).toBe(false);
    expect(wrapper.find(BAR).exists()).toBe(false);
  });

  it('always 时两条轨道常驻，默认不常驻', async () => {
    const always = await mountScrollbar({ always: true });
    expect(always.findAll(BAR)).toHaveLength(2);
    expect(always.find(`${BAR}[data-orientation="vertical"]`).exists()).toBe(
      true,
    );
    expect(always.find(`${BAR}[data-orientation="horizontal"]`).exists()).toBe(
      true,
    );

    const auto = await mountScrollbar();
    expect(auto.find(BAR).exists()).toBe(false);
  });

  /**
   * 默认是 reka 的 `scroll` 显隐：空闲时不渲染轨道，滚动过程中才出现，停止后按
   * `hideDelay` 收起 —— 指针一直停在区域内不影响收起（`hover` 型做不到，鼠标停在
   * 侧栏上轨道就长亮）。reka 先用 100ms 防抖确认"滚动停了"，才进入 hideDelay 倒计时。
   */
  it('滚动时轨道出现，停止后按 hideDelay 自动收起', async () => {
    vi.useFakeTimers();
    const wrapper = await mountScrollbar({ hideDelay: 500 });
    const wrapEl = wrapper.find('.scrollbar__wrap').element as HTMLElement;

    wrapEl.scrollTop = 80;
    await wrapper.find('.scrollbar__wrap').trigger('scroll');
    await vi.advanceTimersByTimeAsync(0);
    await flushPromises();
    expect(wrapper.find(BAR).exists()).toBe(true);

    await vi.advanceTimersByTimeAsync(100);
    await flushPromises();
    expect(wrapper.find(BAR).exists()).toBe(true);

    await vi.advanceTimersByTimeAsync(500);
    await flushPromises();
    expect(wrapper.find(BAR).exists()).toBe(false);
  });

  it('view 用 tag 指定的标签渲染 slot', async () => {
    const wrapper = await mountScrollbar({ tag: 'ul' });
    expect(wrapper.find('ul.scrollbar__view').exists()).toBe(true);
    expect(wrapper.find('.content').text()).toBe('内容');
  });

  it('wrapClass / viewClass 分别落到滚动盒和内容层', async () => {
    const wrapper = await mountScrollbar({
      viewClass: 'view-x',
      wrapClass: 'wrap-x',
    });
    expect(wrapper.find('.scrollbar__wrap').classes()).toContain('wrap-x');
    expect(wrapper.find('.scrollbar__view').classes()).toContain('view-x');
  });
});

describe('滚动事件与对外 API', () => {
  it('scroll 事件带出滚动位置', async () => {
    const wrapper = await mountScrollbar();
    const wrapEl = wrapper.find('.scrollbar__wrap').element as HTMLElement;
    wrapEl.scrollTop = 40;
    wrapEl.scrollLeft = 12;
    await wrapper.find('.scrollbar__wrap').trigger('scroll');

    const payload = wrapper.emitted('scroll')?.at(-1)?.[0] as {
      scrollLeft: number;
      scrollTop: number;
    };
    expect(payload).toEqual({ scrollLeft: 12, scrollTop: 40 });
  });

  it('wrap 暴露的是滚动盒元素本身', async () => {
    const wrapper = await mountScrollbar();
    const vm = wrapper.vm as any;
    expect(vm.wrap).toBe(wrapper.find('.scrollbar__wrap').element);
  });

  it('setScrollTop / setScrollLeft 拒绝 NaN 与非有限值', async () => {
    const wrapper = await mountScrollbar();
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
    const wrapper = await mountScrollbar();
    const wrapEl = wrapper.find('.scrollbar__wrap').element as HTMLElement;
    const scrollTo = vi.fn();
    wrapEl.scrollTo = scrollTo;

    (wrapper.vm as any).scrollTo({ left: 10, top: 20 });
    expect(scrollTo).toHaveBeenCalledWith({ left: 10, top: 20 });
  });

  it('maxHeight 走按窗口高度缩放的响应式上限', async () => {
    // jsdom 视口高 768：495 × (768/1080)^1.938 ≈ 265，被下限 712 兜住
    const wrapper = await mountScrollbar({ maxHeight: 495 });
    expect(wrapper.find('.scrollbar').attributes('style')).toContain(
      'max-height: 712px',
    );
  });

  it('切到 native 后 wrap 指向新的滚动元素', async () => {
    const wrapper = await mountScrollbar();
    const before = (wrapper.vm as any).wrap;
    await wrapper.setProps({ native: true });
    await nextTick();
    await flushPromises();
    expect((wrapper.vm as any).wrap).not.toBe(before);
    expect((wrapper.vm as any).wrap).toBe(
      wrapper.find('.scrollbar__wrap').element,
    );
  });
});
