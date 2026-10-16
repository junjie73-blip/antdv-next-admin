import type { VNode } from 'vue';

import { configureSharedEnv } from '@antdv/shared/utils/env';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, onMounted } from 'vue';
import { afterAll, describe, expect, it } from 'vitest';

import ErrorBoundary from '../src/components/error-boundary/ErrorBoundary.vue';

// 在 onMounted 抛错，触发祖先 ErrorBoundary 的 onErrorCaptured
const makeBoom = (msg = 'boom') =>
  defineComponent({
    name: 'BoomChild',
    setup() {
      onMounted(() => {
        throw new Error(msg);
      });
      return () => h('div', 'ok');
    },
  });

describe('ErrorBoundary', () => {
  it('无错误时渲染 default 插槽', async () => {
    const wrapper = mount(ErrorBoundary, {
      slots: { default: () => h('div', 'child-content') },
    });
    await nextTick();
    expect(wrapper.text()).toContain('child-content');
    expect(wrapper.text()).not.toContain('出错了');
  });

  it('捕获子组件错误后渲染默认兜底 UI 并抛出 error 事件', async () => {
    const wrapper = mount(ErrorBoundary, {
      slots: { default: () => h(makeBoom()) },
    });
    await flushPromises();
    await nextTick();
    expect(wrapper.text()).toContain('出错了');
    expect(wrapper.text()).toContain('boom');
    const emitted = wrapper.emitted('error');
    expect(emitted).toBeTruthy();
    expect(emitted![0]![0]).toBeInstanceOf(Error);
  });

  it('自定义 fallback 渲染传入的 VNode', async () => {
    const fallback = (err: Error): VNode =>
      h('div', { class: 'my-fb' }, `custom:${err.message}`);
    const wrapper = mount(ErrorBoundary, {
      props: { fallback },
      slots: { default: () => h(makeBoom('kaboom')) },
    });
    await flushPromises();
    await nextTick();
    expect(wrapper.find('.my-fb').exists()).toBe(true);
    expect(wrapper.text()).toContain('custom:');
    expect(wrapper.text()).not.toContain('出错了');
  });

  it('resetOnError=false 时不显示重试按钮', async () => {
    const wrapper = mount(ErrorBoundary, {
      props: { resetOnError: false },
      slots: { default: () => h(makeBoom()) },
    });
    await flushPromises();
    await nextTick();
    expect(wrapper.text()).toContain('出错了');
    expect(wrapper.text()).not.toContain('重试');
  });

  it('点击重试按钮抛出 reset 事件', async () => {
    const wrapper = mount(ErrorBoundary, {
      slots: { default: () => h(makeBoom()) },
    });
    await flushPromises();
    await nextTick();
    const btn = wrapper.findAll('button').find((b) => b.text().includes('重试'));
    expect(btn).toBeTruthy();
    await btn!.trigger('click');
    expect(wrapper.emitted('reset')).toBeTruthy();
  });

  // 调用栈详情属于调试信息：开发态给出、生产构建里不渲染。判定走注入的环境配置，所以两个分支都能测。
  it.each([
    [false, true],
    [true, false],
  ])('production=%s 时调用栈详情存在=%s', async (production, expected) => {
    configureSharedEnv({ production });
    const wrapper = mount(ErrorBoundary, {
      slots: { default: () => h(makeBoom()) },
    });
    await flushPromises();
    await nextTick();
    expect(wrapper.find('details').exists()).toBe(expected);
  });
});

// 单测之间共享 `configureSharedEnv` 的模块级状态，收尾复位免得串味
afterAll(() => {
  configureSharedEnv({ production: false });
});
