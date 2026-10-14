import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import Steps from '../src/components/steps/Steps.vue';

const items = [
  { description: '填写基本信息', title: '创建' },
  { description: '等待审核', title: '审核' },
  { description: '流程归档', title: '完成' },
];

const states = (wrapper: ReturnType<typeof mount>) =>
  wrapper
    .findAll('[data-common-steps-item]')
    .map((node) => node.attributes('data-status'));

describe('Steps', () => {
  it('按 items 渲染每一步标题', () => {
    const wrapper = mount(Steps, { props: { items } });
    expect(wrapper.find('[data-common-steps]').exists()).toBe(true);
    expect(wrapper.findAll('[data-common-steps-item]')).toHaveLength(3);
    expect(wrapper.text()).toContain('创建');
    expect(wrapper.text()).toContain('完成');
  });

  it('描述文字渲染在小字 muted 区', () => {
    const wrapper = mount(Steps, { props: { items } });
    expect(wrapper.text()).toContain('填写基本信息');
    expect(wrapper.text()).toContain('流程归档');
  });

  it('current 之前的步骤是 finish，之后是 wait', () => {
    const wrapper = mount(Steps, { props: { current: 1, items } });
    expect(states(wrapper)).toEqual(['finish', 'process', 'wait']);
  });

  it('status 只改写当前这一步', () => {
    const wrapper = mount(
      Steps,
      { props: { current: 1, items, status: 'error' } },
    );
    expect(states(wrapper)).toEqual(['finish', 'error', 'wait']);
    expect(wrapper.text()).toContain('审核');
  });

  it('current 变化后状态跟着重算', async () => {
    const wrapper = mount(Steps, { props: { current: 0, items } });
    expect(states(wrapper)).toEqual(['process', 'wait', 'wait']);
    await wrapper.setProps({ current: 2 });
    expect(states(wrapper)).toEqual(['finish', 'finish', 'process']);
  });

  it('不可点击时没有 button，也不抛事件', async () => {
    const wrapper = mount(Steps, { props: { items } });
    expect(wrapper.findAll('button')).toHaveLength(0);
    await wrapper.findAll('[data-common-steps-item]')[2]!.trigger('click');
    expect(wrapper.emitted('change')).toBeUndefined();
    expect(wrapper.emitted('update:current')).toBeUndefined();
  });

  it('clickable 后按钮可聚焦，点击抛出 change 与 update:current', async () => {
    const wrapper = mount(Steps, { props: { clickable: true, items } });
    const buttons = wrapper.findAll('button');
    expect(buttons).toHaveLength(3);
    expect(buttons[1]!.attributes('type')).toBe('button');

    await buttons[2]!.trigger('click');
    expect(wrapper.emitted('update:current')?.[0]).toEqual([2]);
    expect(wrapper.emitted('change')?.[0]).toEqual([2]);
  });

  it('横向排列，连接线比步骤少一条', () => {
    const wrapper = mount(Steps, { props: { items } });
    expect(wrapper.classes()).toContain('items-start');
    expect(wrapper.findAll('span.h-px')).toHaveLength(2);
  });

  it('纵向排列时连接线改成竖线', () => {
    const wrapper = mount(Steps, { props: { direction: 'vertical', items } });
    expect(wrapper.classes()).toContain('flex-col');
    expect(wrapper.findAll('span.w-px')).toHaveLength(2);
  });

  it('size=small 圆点缩到 20px', () => {
    const wrapper = mount(Steps, { props: { items, size: 'small' } });
    expect(wrapper.find('span.size-5').exists()).toBe(true);
    expect(wrapper.find('span.size-6').exists()).toBe(false);
  });

  it('已完成的步骤用对勾图标顶掉序号', () => {
    const wrapper = mount(Steps, { props: { current: 1, items } });
    const finished = wrapper.findAll('[data-common-steps-item]')[0]!;
    expect(finished.text()).not.toContain('1');
    expect(finished.find('[class*="text-primary-foreground"]').exists()).toBe(
      true,
    );
    const current = wrapper.findAll('[data-common-steps-item]')[1]!;
    expect(current.text()).toContain('2');
  });
});
