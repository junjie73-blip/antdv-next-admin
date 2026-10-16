import { nextTick } from 'vue';

import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createContainerLoading,
  createLoading,
} from '../src/components/loading/createLoading';
import Loading from '../src/components/loading/Loading.vue';
import loadingDirective from '../src/components/loading/directive';
import { LEAVE_DURATION } from '../src/components/loading/overlay';
import { useLoading } from '../src/components/loading/useLoading';

/**
 * `overlay.ts` 用 `createApp` 往真实 DOM 里插节点，测试必须自己收尾，
 * 否则前一条用例留下的遮罩会干扰后面的 body 级查询。
 */
const live: { destroy: () => void }[] = [];

function track<T extends { destroy: () => void }>(instance: T): T {
  live.push(instance);
  return instance;
}

function fullscreenWrapper(): HTMLElement | null {
  return document.body.querySelector('.loading-wrapper');
}

/** 推进淡出计时并等 Vue 把卸载落到 DOM 上 */
async function settleLeave() {
  vi.advanceTimersByTime(LEAVE_DURATION + 10);
  await nextTick();
}

afterEach(() => {
  while (live.length > 0) {
    live.pop()?.destroy();
  }
  document.body.innerHTML = '';
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('Loading 组件', () => {
  it('loading 为 false 时遮罩不可见', () => {
    const wrapper = mount(Loading, { props: { loading: false } });
    expect(wrapper.find('.loading-wrapper').isVisible()).toBe(false);
  });

  it('容器内模式铺满父级并使用浅色半透明底', () => {
    const wrapper = mount(Loading, {
      props: { absolute: true, loading: true, theme: 'light' },
    });
    const classes = wrapper.find('.loading-wrapper').classes();
    expect(classes).toContain('absolute');
    expect(classes).toContain('size-full');
    expect(classes).toContain('bg-white/60');
    expect(classes).not.toContain('fixed');
  });

  it('自定义背景优先于主题类', () => {
    const wrapper = mount(Loading, {
      props: { background: 'rgb(1, 2, 3)', loading: true, theme: 'dark' },
    });
    const el = wrapper.find('.loading-wrapper');
    expect(el.attributes('style')).toContain('background-color: rgb(1, 2, 3)');
    expect(el.classes()).not.toContain('bg-black/70');
  });

  it('三档尺寸给出真实的 Spinner 尺寸类与档位钩子类', () => {
    const large = mount(Loading, { props: { loading: true, size: 'large' } });
    expect(large.find('.loading-wrapper').classes()).toContain('loading-large');
    // Spinner 自带 `size-4`，靠 tailwind-merge 让调用方的档位覆盖它
    expect(large.find('.loading-spin svg').classes()).toContain('size-9');
    expect(large.find('.loading-spin svg').classes()).not.toContain('size-4');

    const small = mount(Loading, { props: { loading: true, size: 'small' } });
    expect(small.find('.loading-wrapper').classes()).toContain('loading-small');
    expect(small.find('.loading-spin svg').classes()).toContain('size-4');
  });

  it('渲染的是 shadcn Spinner，不是组件库的 Spin', () => {
    const wrapper = mount(Loading, { props: { loading: true } });
    expect(wrapper.find('.ant-spin').exists()).toBe(false);
    expect(wrapper.find('svg[role="status"]').exists()).toBe(true);
  });

  it('提示文本按需渲染', () => {
    const withTip = mount(Loading, {
      props: { loading: true, tip: '加载中…' },
    });
    expect(withTip.find('.loading-tip').text()).toBe('加载中…');
    /*
     * 文字颜色必须走主题主色（`text-primary` → `--color-primary` → `--app-primary`），
     * 不能是继承下来的黑字，也不能写死色值。
     */
    expect(withTip.find('.loading-tip').classes()).toContain('text-primary');

    const noTip = mount(Loading, { props: { loading: true } });
    expect(noTip.find('.loading-tip').exists()).toBe(false);
  });
});

describe('useLoading', () => {
  it('open 才挂载 DOM，close 等淡出动画后才摘除', async () => {
    vi.useFakeTimers();
    const instance = track(useLoading({ tip: '处理中' }));

    expect(fullscreenWrapper()).toBeNull();
    instance.open();
    await nextTick();
    expect(fullscreenWrapper()).not.toBeNull();
    expect(fullscreenWrapper()?.textContent).toContain('处理中');

    instance.close();
    await nextTick();
    expect(fullscreenWrapper()).not.toBeNull();
    await settleLeave();
    expect(fullscreenWrapper()).toBeNull();
  });

  it('setTip / setLoading 直接驱动已挂载的遮罩', async () => {
    const instance = track(useLoading());
    instance.setLoading(true);
    await nextTick();

    instance.setTip('新文案');
    await nextTick();
    expect(fullscreenWrapper()?.textContent).toContain('新文案');

    instance.setLoading(false);
    instance.destroy();
    expect(fullscreenWrapper()).toBeNull();
  });

  it('淡出过程中重新 open 不会留下残影或僵尸 DOM', async () => {
    vi.useFakeTimers();
    const instance = track(useLoading());
    instance.open();
    await nextTick();

    instance.close();
    instance.open();
    await settleLeave();
    expect(fullscreenWrapper()).not.toBeNull();
    expect(document.body.querySelectorAll('.loading-wrapper')).toHaveLength(1);
  });

  it('目标容器晚于 open 出现时，再次 open 会重试挂载', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const host = document.createElement('div');
    document.body.append(host);
    let resolved: HTMLElement | undefined;

    const instance = track(useLoading({ body: false, target: () => resolved }));
    instance.open();
    await nextTick();
    expect(host.querySelector('.loading-wrapper')).toBeNull();
    expect(warn).toHaveBeenCalled();

    resolved = host;
    instance.open();
    await nextTick();
    expect(host.querySelector('.loading-wrapper')).not.toBeNull();
    // 非定位父级会被补上 relative，否则 absolute 遮罩按视口铺满
    expect(host.style.position).toBe('relative');
    warn.mockRestore();
    host.remove();
  });
});

describe('createLoading', () => {
  it('默认全屏，close 触发 onClose', async () => {
    const onClose = vi.fn();
    const instance = track(createLoading({ onClose, tip: '请求中' }));
    instance.open();
    await nextTick();
    expect(fullscreenWrapper()?.classList.contains('fixed')).toBe(true);

    instance.close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('createContainerLoading 显式的 body: false 不被默认值覆盖', async () => {
    const host = document.createElement('div');
    document.body.append(host);

    const instance = track(createContainerLoading(host, '容器加载中'));
    instance.open();
    await nextTick();
    expect(host.querySelector('.loading-wrapper')).not.toBeNull();
    expect(host.querySelector('.loading-wrapper')?.classList).toContain(
      'absolute',
    );
    host.remove();
  });
});

describe('v-loading 指令', () => {
  const DirectiveHost = {
    directives: { loading: loadingDirective },
    props: ['value', 'tip'],
    template: `<div v-loading="value" :loading-tip="tip">内容</div>`,
  };

  it('值从 false 变 true 时挂上遮罩，变回 false 后撤掉', async () => {
    vi.useFakeTimers();
    // 指令把遮罩插进宿主元素内部，所以必须挂到 document.body 上才查得到
    const wrapper = mount(DirectiveHost, {
      attachTo: document.body,
      props: { value: false },
    });
    expect(document.body.querySelector('.loading-wrapper')).toBeNull();

    await wrapper.setProps({ value: true });
    await nextTick();
    const overlay = document.body.querySelector('.loading-directive-wrapper');
    expect(overlay).not.toBeNull();
    expect(overlay?.querySelector('.loading-wrapper')).not.toBeNull();

    await wrapper.setProps({ value: false });
    await settleLeave();
    expect(
      document.body.querySelector('.loading-directive-wrapper'),
    ).toBeNull();
    wrapper.unmount();
  });

  it('指令参数与 loading-tip 属性都能提供文案', async () => {
    const wrapper = mount(
      {
        directives: { loading: loadingDirective },
        template: `<div v-loading:提交中="true" loading-tip="忽略">内容</div>`,
      },
      { attachTo: document.body },
    );
    await nextTick();
    expect(document.body.querySelector('.loading-tip')?.textContent).toBe(
      '提交中',
    );
    wrapper.unmount();
  });
});
