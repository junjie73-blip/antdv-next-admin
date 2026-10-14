import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import Transfer from '../src/components/transfer/Transfer.vue';

const data = [
  { disabled: true, key: 3, title: '王五' },
  { key: 1, title: '张三' },
  { key: '2', title: '李四' },
];

const panel = (wrapper: ReturnType<typeof mount>, direction: 'left' | 'right') =>
  wrapper.find(`[data-common-transfer-panel][data-direction="${direction}"]`);
const items = (wrapper: ReturnType<typeof mount>, direction: 'left' | 'right') =>
  panel(wrapper, direction).findAll('[data-common-transfer-item]');
const item = (wrapper: ReturnType<typeof mount>, direction: 'left' | 'right', key: string) =>
  panel(wrapper, direction).find(`[data-common-transfer-item][data-key="${key}"]`);

describe('Transfer', () => {
  it('按 targetKeys 拆分左右两栏并渲染标题', () => {
    const wrapper = mount(Transfer, {
      props: { dataSource: data, targetKeys: ['2'], titles: ['待选用户', '已选用户'] },
    });
    expect(items(wrapper, 'left')).toHaveLength(2);
    expect(items(wrapper, 'right')).toHaveLength(1);
    expect(panel(wrapper, 'right').text()).toContain('李四');
    expect(wrapper.text()).toContain('待选用户');
    expect(wrapper.text()).toContain('已选用户');
  });

  it('render 自定义条目文案', () => {
    const wrapper = mount(Transfer, {
      props: { dataSource: data, render: (item: any) => `#${item.key}`, targetKeys: [] },
    });
    expect(item(wrapper, 'left', '1').text()).toContain('#1');
  });

  it('勾选后点击右移按钮抛出 update:targetKeys 与 change', async () => {
    const wrapper = mount(Transfer, {
      props: { dataSource: data, targetKeys: ['2'] },
    });
    await item(wrapper, 'left', '1')
      .find('[data-slot="checkbox"]')
      .trigger('click');
    expect(wrapper.emitted('select')?.[0]).toEqual(['left', [1]]);

    await wrapper
      .find('[data-common-transfer-move="right"]')
      .trigger('click');
    expect(wrapper.emitted('update:targetKeys')?.[0]).toEqual([['2', 1]]);
    expect(wrapper.emitted('change')?.[0]).toEqual([['2', 1], 'right', [1]]);
  });

  it('左移按钮剔除已移出的键', async () => {
    const wrapper = mount(Transfer, {
      props: { dataSource: data, targetKeys: ['2'] },
    });
    await item(wrapper, 'right', '2')
      .find('[data-slot="checkbox"]')
      .trigger('click');
    await wrapper.find('[data-common-transfer-move="left"]').trigger('click');
    expect(wrapper.emitted('update:targetKeys')?.[0]).toEqual([[]]);
    expect(wrapper.emitted('change')?.[0]).toEqual([[], 'left', ['2']]);
  });

  it('show-search 时按渲染文案过滤条目', async () => {
    const wrapper = mount(Transfer, {
      props: { dataSource: data, showSearch: true, targetKeys: [] },
    });
    const inputs = wrapper.findAll('input[data-common-transfer-search]');
    expect(inputs).toHaveLength(2);
    await inputs[0]!.setValue('张三');
    expect(items(wrapper, 'left')).toHaveLength(1);
    expect(items(wrapper, 'right')).toHaveLength(0);
  });

  it('禁用条目不可勾选', async () => {
    const wrapper = mount(Transfer, {
      props: { dataSource: data, targetKeys: [] },
    });
    await item(wrapper, 'left', '3')
      .find('[data-slot="checkbox"]')
      .trigger('click');
    expect(wrapper.emitted('select')).toBeUndefined();
  });

  it('头部计数随勾选变化', async () => {
    const wrapper = mount(Transfer, {
      props: { dataSource: data, targetKeys: [] },
    });
    expect(panel(wrapper, 'left').text()).toContain('0/3');
    await item(wrapper, 'left', '1')
      .find('[data-slot="checkbox"]')
      .trigger('click');
    expect(panel(wrapper, 'left').text()).toContain('1/3');
  });

  it('头部全选跳过禁用项，只抛出可选项', async () => {
    const wrapper = mount(Transfer, {
      props: { dataSource: data, targetKeys: [] },
    });
    await panel(wrapper, 'left')
      .find('[data-slot="checkbox"]')
      .trigger('click');
    expect(wrapper.emitted('select')?.[0]).toEqual(['left', [1, '2']]);
  });

  it('oneWay 隐藏左移按钮，未勾选时按钮禁用', () => {
    const wrapper = mount(Transfer, {
      props: { dataSource: data, oneWay: true, targetKeys: [] },
    });
    expect(wrapper.find('[data-common-transfer-move="left"]').exists()).toBe(false);
    expect(
      wrapper.find('[data-common-transfer-move="right"]').attributes('disabled'),
    ).toBeDefined();
  });
});
