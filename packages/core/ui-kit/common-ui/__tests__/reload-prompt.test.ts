import { flushPromises, mount } from '@vue/test-utils';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ReloadPrompt from '../src/components/reload-prompt/ReloadPrompt.vue';

const route = { checkUpdate: () => {}, onRouteChange: () => {} };

function mountPrompt(props: Record<string, any> = {}) {
  return mount(ReloadPrompt, {
    props: { autoCountdown: 3, pollInterval: 1000, ...props },
  });
}

/** 暴露给宿主的两个入口（迁移前是组件自己 watch 路由 + 自己调 SW） */
function exposed(wrapper: any): typeof route {
  return wrapper.vm as unknown as typeof route;
}

/** 取不到按钮就失败：留 `!` 断言只会把「按钮没渲染」拖成运行时 TypeError */
function clickButtonByText(wrapper: any, text: string) {
  const button = wrapper
    .findAll('button')
    .find((b: any) => b.text().includes(text));
  if (!button) throw new Error(`找不到文本含「${text}」的按钮`);
  return button.trigger('click');
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('更新提示的显示口径', () => {
  it('既没有新版本也没有离线就绪时不挂提示', () => {
    const wrapper = mountPrompt();

    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it('离线就绪是「知道了」，发现新版本才是「立即更新 / 稍后」', () => {
    const offline = mountPrompt({ offlineReady: true });
    expect(offline.text()).toContain('离线可用');
    expect(offline.text()).toContain('知道了');
    expect(offline.text()).not.toContain('立即更新');

    const update = mountPrompt({ needRefresh: true });
    expect(update.text()).toContain('发现新版本');
    expect(update.text()).toContain('立即更新');
    expect(update.text()).not.toContain('知道了');
  });

  it('关闭与「知道了」都只 emit dismiss，状态由宿主清', async () => {
    const wrapper = mountPrompt({ offlineReady: true });

    await wrapper.find('button[aria-label="关闭"]').trigger('click');

    expect(wrapper.emitted('dismiss')).toHaveLength(1);
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
  });
});

describe('更新提示的自动更新倒计时', () => {
  it('倒计时走完就 emit update(true)，与迁移前一致', async () => {
    const wrapper = mountPrompt({ autoCountdown: 3, needRefresh: true });

    await vi.advanceTimersByTimeAsync(4000);

    expect(wrapper.emitted('update')?.[0]).toEqual([true]);
  });

  it('点「稍后」取消自动更新后，倒计时走完也不再 emit', async () => {
    const wrapper = mountPrompt({ autoCountdown: 3, needRefresh: true });

    await clickButtonByText(wrapper, '稍后');
    await vi.advanceTimersByTimeAsync(5000);

    expect(wrapper.text()).toContain('已暂停自动更新');
    expect(wrapper.emitted('update')).toBeUndefined();
  });

  it('autoCountdown<=0 表示不自动更新，只有手动点才 emit', async () => {
    const wrapper = mountPrompt({
      autoCountdown: 0,
      needRefresh: true,
    });

    await vi.advanceTimersByTimeAsync(5000);
    expect(wrapper.emitted('update')).toBeUndefined();

    await clickButtonByText(wrapper, '立即更新');

    expect(wrapper.emitted('update')?.[0]).toEqual([true]);
  });
});

describe('更新提示的轮询与节流（宿主的 onCheckUpdate）', () => {
  it('挂上就按 pollInterval 轮询，卸载后停止', async () => {
    const onCheckUpdate = vi.fn();
    const wrapper = mountPrompt({ onCheckUpdate });

    await vi.advanceTimersByTimeAsync(2500);
    expect(onCheckUpdate).toHaveBeenCalledTimes(2);

    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(5000);
    expect(onCheckUpdate).toHaveBeenCalledTimes(2);
  });

  it('onRouteChange 有 30s 节流，checkUpdate 没有', async () => {
    const onCheckUpdate = vi.fn();
    const wrapper = mountPrompt({ onCheckUpdate });
    await flushPromises();
    onCheckUpdate.mockClear();

    exposed(wrapper).onRouteChange();
    exposed(wrapper).onRouteChange();
    expect(onCheckUpdate).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(31_000);
    const afterPoll = onCheckUpdate.mock.calls.length;
    exposed(wrapper).onRouteChange();
    expect(onCheckUpdate).toHaveBeenCalledTimes(afterPoll + 1);

    exposed(wrapper).checkUpdate();
    exposed(wrapper).checkUpdate();
    expect(onCheckUpdate).toHaveBeenCalledTimes(afterPoll + 3);
  });

  it('页面重新可见时先延迟检查一次，再恢复轮询', async () => {
    const onCheckUpdate = vi.fn();
    mountPrompt({ onCheckUpdate, visibilityCheckDelay: 500 });
    await flushPromises();
    onCheckUpdate.mockClear();

    // jsdom 的 document.visibilityState 恒为 visible，直接驱动组件里的 watch 源
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    await flushPromises();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    await flushPromises();
    await vi.advanceTimersByTimeAsync(500);

    expect(onCheckUpdate).toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
  });
});
