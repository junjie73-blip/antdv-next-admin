import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ScreenHeader from '../components/ScreenHeader.vue';

/**
 * jsdom 完全没有实现 Fullscreen API：`Element.prototype.requestFullscreen`、
 * `document.exitFullscreen`、`document.fullscreenElement` 都不存在，
 * 所以这几个要手动挂 / 手动摘（`vi.restoreAllMocks()` 管不到手写属性）。
 */
const stash: Array<{
  descriptor: PropertyDescriptor | undefined;
  key: string;
  target: any;
}> = [];

function define(target: any, key: string, value: unknown) {
  stash.push({ descriptor: Reflect.getOwnPropertyDescriptor(target, key), key, target });
  Object.defineProperty(target, key, {
    configurable: true,
    value,
    writable: true,
  });
}

/**
 * 组件走的是 `document.documentElement.requestFullscreen()` 和
 * `document.exitFullscreen()`，所以挂在具体对象上，不用管原型链。
 */
function stubFullscreen(api: {
  exitFullscreen?: () => Promise<void>;
  requestFullscreen?: () => Promise<void>;
} = {}) {
  if (api.requestFullscreen) {
    define(document.documentElement, 'requestFullscreen', api.requestFullscreen);
  }
  if (api.exitFullscreen) {
    define(document, 'exitFullscreen', api.exitFullscreen);
  }
}

function setFullscreenElement(value: Element | null) {
  define(document, 'fullscreenElement', value);
}

function restoreFullscreen() {
  while (stash.length > 0) {
    const { descriptor, key, target } = stash.pop()!;
    if (descriptor) Object.defineProperty(target, key, descriptor);
    else delete target[key];
  }
}

/**
 * 大屏头部的两条约束：
 * 1. 图标是真的组件（`@antdv-next/icons`），不是模板里凭空写的标签 ——
 *    之前这里直接写 `<FullscreenOutlined />` 而没 import，浏览器控制台报
 *    "Failed to resolve component"，大屏顶栏上按钮只剩文字、图标全空；
 * 2. `fullscreenchange` 的监听必须能摘掉 —— 之前 add/remove 用的是两个不同的
 *    匿名函数，等于永久监听，反复进出大屏会在 document 上堆积回调。
 */
describe('ScreenHeader', () => {
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;
  let handlers: Array<() => void>;

  beforeEach(() => {
    handlers = [];
    addSpy = vi
      .spyOn(document, 'addEventListener')
      .mockImplementation((type: string, handler: any) => {
        if (type === 'fullscreenchange') handlers.push(handler);
      });
    removeSpy = vi
      .spyOn(document, 'removeEventListener')
      .mockImplementation((type: string, handler: any) => {
        if (type !== 'fullscreenchange') return;
        const index = handlers.indexOf(handler);
        if (index >= 0) handlers.splice(index, 1);
      });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    // LIFO 回滚：同一个 key 被 define 过几次就还原几次，最后一次回到 jsdom 的原始状态
    restoreFullscreen();
  });

  it('挂载后注册一个全屏监听，卸载后摘干净', () => {
    const wrapper = mount(ScreenHeader, { props: { title: '监控大屏' } });
    expect(addSpy).toHaveBeenCalledWith(
      'fullscreenchange',
      expect.any(Function),
    );
    expect(handlers).toHaveLength(1);

    wrapper.unmount();
    expect(handlers).toHaveLength(0);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    // 摘的必须是挂的那个引用，否则等于没摘
    expect(removeSpy.mock.calls[0]![1]).toBe(addSpy.mock.calls[0]![1]);
  });

  it('图标组件解析成功：按钮里渲染出 anticon 容器', () => {
    const wrapper = mount(ScreenHeader, { props: { title: '监控大屏' } });
    // 解析不到组件时这里只剩文字，.anticon 一个都不会有
    expect(wrapper.findAll('.anticon').length).toBeGreaterThan(0);
    expect(wrapper.text()).toContain('全屏');
  });

  it('点按钮进入全屏；浏览器拒绝时不炸（不接住的 reject 会变成未处理异常）', async () => {
    const requestFullscreen = vi
      .fn()
      .mockImplementation(() => Promise.resolve());
    stubFullscreen({ requestFullscreen });

    const wrapper = mount(ScreenHeader);
    await wrapper.find('button').trigger('click');
    expect(requestFullscreen).toHaveBeenCalledTimes(1);

    // 浏览器策略禁止全屏时返回 rejected promise：组件必须 catch 住，
    // 否则控制台多一条 Uncaught (in promise)，用户看不出发生了什么
    requestFullscreen.mockImplementation(() => Promise.reject(new Error('not allowed')));
    await wrapper.find('button').trigger('click');
    await flushPromises();
    expect(wrapper.find('button').exists()).toBe(true);
    wrapper.unmount();
  });

  it('fullscreenchange 驱动按钮状态，而不是点击时自己猜（F11 进的全屏也要认）', async () => {
    const requestFullscreen = vi.fn(() => Promise.resolve());
    const exitFullscreen = vi.fn(() => Promise.resolve());
    stubFullscreen({ exitFullscreen, requestFullscreen });

    const wrapper = mount(ScreenHeader);
    const button = () => wrapper.get('button');
    expect(button().attributes('aria-label')).toBe('全屏');

    // 浏览器进入全屏后派发事件：状态来自 fullscreenElement，不是点击时的乐观假设
    setFullscreenElement(document.documentElement);
    handlers[0]!();
    await nextTick();
    expect(button().attributes('aria-label')).toBe('退出全屏');

    // 全屏态下点按钮走 exitFullscreen，不能再调 requestFullscreen
    await button().trigger('click');
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    expect(requestFullscreen).not.toHaveBeenCalled();

    setFullscreenElement(null);
    handlers[0]!();
    await nextTick();
    expect(button().attributes('aria-label')).toBe('全屏');
    wrapper.unmount();
  });

  it('showFullscreen=false 时不渲染操作按钮', () => {
    const wrapper = mount(ScreenHeader, {
      props: { showFullscreen: false, title: 'x' },
    });
    expect(wrapper.findAll('button')).toHaveLength(0);
  });

  it('卸载后不再有时间轮询（清掉时钟引用，避免大屏页退出后还在跑）', async () => {
    vi.useFakeTimers();
    const wrapper = mount(ScreenHeader);
    wrapper.unmount();
    // clearInterval 之后再推进时间不应抛错（组件实例已销毁，回调还跑就会碰到已释放的 ref）
    expect(() => vi.advanceTimersByTime(5000)).not.toThrow();
    vi.useRealTimers();
  });
});
