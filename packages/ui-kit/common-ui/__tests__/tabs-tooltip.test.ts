import { mount } from '@vue/test-utils';
import { h, nextTick } from 'vue';

import { describe, expect, it } from 'vitest';

import TabPane from '../src/components/tabs/TabPane.vue';
import Tabs from '../src/components/tabs/Tabs.vue';
import Tooltip from '../src/components/tooltip/Tooltip.vue';

/** 面板在自身 setup 里注册，标签头要多一轮渲染才出现 */
async function buildTabs(props: Record<string, any> = {}) {
  const wrapper = mount(
    h(Tabs, props, () => [
      h(TabPane, { tab: '基本信息', value: 'basic' }, () => '基础内容'),
      h(TabPane, { tab: '安全设置', value: 'security' }, () => '安全内容'),
      h(TabPane, { disabled: true, tab: '团队', value: 'team' }, () => '团队内容'),
    ]),
  );
  await nextTick();
  return wrapper;
}

const triggersOf = (wrapper: Awaited<ReturnType<typeof buildTabs>>) =>
  wrapper.findAll('[data-common-tabs-list] button');

const visibleTextOf = (wrapper: Awaited<ReturnType<typeof buildTabs>>) =>
  wrapper
    .findAll('[data-common-tabs-pane]')
    .filter((node) => !node.classes().includes('hidden'))
    .map((node) => node.text())
    .join('|');

describe('Tabs / TabPane', () => {
  it('标签头由注册的 TabPane 生成', async () => {
    const wrapper = await buildTabs();
    const triggers = triggersOf(wrapper);
    expect(triggers).toHaveLength(3);
    expect(triggers.map((node) => node.text())).toEqual([
      '基本信息',
      '安全设置',
      '团队',
    ]);
  });

  it('未受控时首个标签默认激活，切过的面板隐藏但保留状态', async () => {
    const wrapper = await buildTabs();
    expect(wrapper.findAll('[data-common-tabs-pane]')).toHaveLength(1);
    expect(visibleTextOf(wrapper)).toBe('基础内容');

    await triggersOf(wrapper)[1]!.trigger('click');
    expect(wrapper.findAll('[data-common-tabs-pane]')).toHaveLength(2);
    expect(visibleTextOf(wrapper)).toBe('安全内容');
  });

  it('未禁用的标签点击后上报，禁用标签不响应', async () => {
    const wrapper = await buildTabs();
    await triggersOf(wrapper)[2]!.trigger('click');
    expect(wrapper.emitted('update:activeKey')).toBeUndefined();

    await triggersOf(wrapper)[1]!.trigger('click');
    expect(wrapper.emitted('update:activeKey')?.[0]).toEqual(['security']);
    expect(wrapper.emitted('change')?.[0]).toEqual(['security']);
  });

  it('受控 activeKey 跟随父组件，点击只上报不自行切换', async () => {
    const wrapper = await buildTabs({ activeKey: 'security' });
    expect(visibleTextOf(wrapper)).toBe('安全内容');

    await triggersOf(wrapper)[0]!.trigger('click');
    expect(wrapper.emitted('update:activeKey')?.[0]).toEqual(['basic']);
    expect(wrapper.emitted('change')?.[0]).toEqual(['basic']);
    expect(visibleTextOf(wrapper)).toBe('安全内容');

    await wrapper.setProps({ activeKey: 'basic' });
    expect(visibleTextOf(wrapper)).toBe('基础内容');
  });

  it('line 与 card 形态给出不同的标签样式', async () => {
    const line = await buildTabs();
    expect(triggersOf(line)[0]!.classes().join(' ')).toContain('border-b-2');

    const card = await buildTabs({ type: 'card' });
    expect(triggersOf(card)[0]!.classes().join(' ')).toContain('rounded-t-md');
  });
});

describe('Tooltip', () => {
  it('有标题时把子节点变成悬浮触发器', () => {
    const wrapper = mount(
      h(Tooltip, { placement: 'right', title: '提示文案' }, () => h('button', '目标')),
    );
    expect(wrapper.find('[data-slot="tooltip-trigger"]').exists()).toBe(true);
    expect(wrapper.text()).toBe('目标');
  });

  it('没有标题时退化成直接渲染子节点', () => {
    const wrapper = mount(h(Tooltip, null, () => h('button', '目标')));
    expect(wrapper.find('[data-slot="tooltip-trigger"]').exists()).toBe(false);
    expect(wrapper.text()).toBe('目标');
  });
});
