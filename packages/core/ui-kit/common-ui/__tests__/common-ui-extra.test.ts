import { mount } from '@vue/test-utils';
import { h } from 'vue';

import { describe, expect, it } from 'vitest';

import Descriptions from '../src/components/descriptions/Descriptions.vue';
import DescriptionsItem from '../src/components/descriptions/DescriptionsItem.vue';
import Empty from '../src/components/empty/Empty.vue';
import Popconfirm from '../src/components/popconfirm/Popconfirm.vue';
import Segmented from '../src/components/segmented/Segmented.vue';
import Statistic from '../src/components/statistic/Statistic.vue';
import Timeline from '../src/components/timeline/Timeline.vue';
import TimelineItem from '../src/components/timeline/TimelineItem.vue';
import Tree from '../src/components/tree/Tree.vue';

const item = DescriptionsItem;

describe('Descriptions', () => {
  it('栅格列数跟随 column，条目按 span 占列', () => {
    const wrapper = mount(
      h(Descriptions, { column: 2, title: '基础信息' }, () => [
        h(item, { label: '用户名' }, () => 'zhang'),
        h(item, { label: '简介', span: 2 }, () => 'hello'),
      ])
    );

    expect(wrapper.text()).toContain('基础信息');
    const grid = wrapper.find('[style*="grid-template-columns"]');
    expect(grid.attributes('style')).toContain('repeat(2');

    const cells = wrapper.findAll('[data-common-descriptions-item]');
    expect(cells).toHaveLength(2);
    expect(cells[1]!.attributes('style')).toContain('span 2');
    expect(wrapper.text()).toContain('zhang');
  });

  it('bordered 时标签格带上底色', () => {
    const wrapper = mount(
      h(Descriptions, { bordered: true }, () => h(item, { label: '用户名' }, () => 'zhang'))
    );
    const label = wrapper.find('[data-common-descriptions-item] div');
    expect(label.classes().join(' ')).toContain('bg-muted/40');
  });
});

describe('Timeline', () => {
  it('条目渲染出自定义 dot 与内容', () => {
    const wrapper = mount(
      h(Timeline, () => [
        h(TimelineItem, null, {
          default: () => '登录系统',
          dot: () => h('i', { class: 'custom-dot' }),
        }),
        h(TimelineItem, { color: 'red' }, () => '修改密码'),
      ])
    );

    expect(wrapper.findAll('[data-common-timeline-item]')).toHaveLength(2);
    expect(wrapper.find('.custom-dot').exists()).toBe(true);
    expect(wrapper.text()).toContain('修改密码');
  });

  it('非预设颜色落到内联样式', () => {
    const wrapper = mount(h(TimelineItem, { color: '#ff0000' }, () => 'x'));
    const dot = wrapper.find('[style*="background-color"]');
    expect(dot.exists()).toBe(true);
  });
});

describe('Segmented', () => {
  const options = ['甲', { label: '乙', value: 'b' }];

  it('字符串与对象选项都能渲染', () => {
    const wrapper = mount(Segmented, { props: { options } });
    const items = wrapper.findAll('[data-slot="toggle-group-item"]');
    expect(items).toHaveLength(2);
    expect(items[0]!.text()).toContain('甲');
  });

  it('点选项抛出 update:value 与 change', async () => {
    const wrapper = mount(Segmented, {
      props: { options, value: 'a' },
    });
    await wrapper
      .findAll('[data-slot="toggle-group-item"]')[1]!
      .trigger('click');
    expect(wrapper.emitted('update:value')?.[0]).toEqual(['b']);
    expect(wrapper.emitted('change')?.[0]).toEqual(['b']);
  });

  it('禁用后不再抛出选中事件', async () => {
    const wrapper = mount(Segmented, { props: { disabled: true, options } });
    await wrapper
      .findAll('[data-slot="toggle-group-item"]')[0]!
      .trigger('click');
    expect(wrapper.emitted('update:value')).toBeUndefined();
  });
});

describe('Statistic', () => {
  it('千分位与小数位', () => {
    const wrapper = mount(Statistic, {
      props: { precision: 2, title: '总量', value: 1_234_567.891 },
    });
    expect(wrapper.find('[data-common-statistic-value]').text()).toBe(
      '1,234,567.89'
    );
    expect(wrapper.text()).toContain('总量');
  });

  it('空值给出占位', () => {
    const wrapper = mount(Statistic, {});
    expect(wrapper.find('[data-common-statistic-value]').text()).toBe('-');
  });
});

describe('Empty', () => {
  it('默认文案是"暂无数据"，image=false 时不渲染图标', () => {
    const wrapper = mount(Empty, { props: { image: false } });
    expect(wrapper.text()).toContain('暂无数据');
    expect(wrapper.find('[data-slot="empty-icon"]').exists()).toBe(false);
  });

  it('默认给出占位图标', () => {
    const wrapper = mount(Empty, {});
    expect(wrapper.find('[data-slot="empty-icon"] svg').exists()).toBe(true);
  });
});

describe('Popconfirm', () => {
  it('未打开时只有触发区，打开后面板带确定与取消', async () => {
    const wrapper = mount(Popconfirm, {
      props: { title: '删除该条记录？' },
      slots: { default: '<button data-test="trigger">删除</button>' },
      attachTo: document.body,
    });
    expect(wrapper.find('[data-test="trigger"]').exists()).toBe(true);
    expect(document.querySelector('[data-common-popconfirm]')).toBeNull();

    await wrapper.setProps({ open: true });
    const panel = document.querySelector('[data-common-popconfirm]');
    expect(panel?.textContent).toContain('删除该条记录？');
    expect(panel?.textContent).toContain('确定');
    expect(panel?.textContent).toContain('取消');

    wrapper.unmount();
  });

  /**
   * reka 的浮层要等一次 tick 才挂到 body 上，`open: true` 直接给到 mount 是拿不到面板的。
   * 面板取"最后一只"：前一条用例失败时来不及 unmount，`querySelector` 会命中那只残留的。
   */
  async function openPanel(props: Record<string, unknown> = {}) {
    const wrapper = mount(Popconfirm, {
      props: { title: '确定删除？', ...props },
      slots: { default: '<button>删除</button>' },
      attachTo: document.body,
    });
    await wrapper.setProps({ open: true });
    const panels = document.querySelectorAll('[data-common-popconfirm]');
    return { panel: panels[panels.length - 1] as HTMLElement, wrapper };
  }

  it('标题与说明各占一档行距，说明走 muted 而不是写死的灰', async () => {
    const { panel, wrapper } = await openPanel({ description: '删除后不可恢复' });
    const desc = [...panel.querySelectorAll('div')]
      .filter((el) => el.textContent?.includes('删除后不可恢复'))
      .at(-1);
    expect(desc?.className).toContain('text-muted-foreground');
    expect(desc?.className).not.toMatch(/text-gray-\d/);
    wrapper.unmount();
  });

  it('默认带警示图标，showIcon=false 才没有', async () => {
    const first = await openPanel();
    expect(first.panel.querySelector('svg, .iconify')).not.toBeNull();
    first.wrapper.unmount();

    const second = await openPanel({ danger: true, showIcon: false });
    expect(second.panel.querySelector('svg, .iconify')).toBeNull();
    second.wrapper.unmount();
  });

  it('确定与取消都把原生事件带回给调用方', async () => {
    const { panel, wrapper } = await openPanel();
    const buttons = [...panel.querySelectorAll('button')];
    buttons.at(-1)?.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('confirm')?.[0]?.[0]).toBeInstanceOf(MouseEvent);
    wrapper.unmount();
  });
});

const treeData = [
  {
    id: 1,
    name: '总部',
    children: [
      { id: 11, name: '研发' },
      { id: 12, name: '市场', children: [{ id: 121, name: '增长' }] },
    ],
  },
  { id: 2, name: '分部' },
];

const fieldNames = { children: 'children', key: 'id', title: 'name' };

const rows = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('[data-common-tree-node]');
const boxes = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('[data-common-tree-checkbox] button');

describe('Tree', () => {
  it('默认收起，只渲染根节点', () => {
    const wrapper = mount(Tree, { props: { fieldNames, treeData } });
    expect(rows(wrapper)).toHaveLength(2);
    expect(wrapper.text()).toContain('总部');
  });

  it('defaultExpandAll 展开整棵树', () => {
    const wrapper = mount(Tree, {
      props: { defaultExpandAll: true, fieldNames, treeData },
    });
    expect(rows(wrapper)).toHaveLength(5);
  });

  it('点展开箭头抛出 update:expandedKeys 并渲染子节点', async () => {
    const wrapper = mount(Tree, { props: { fieldNames, treeData } });
    await wrapper.find('[data-common-tree-switcher]').trigger('click');
    expect((wrapper.emitted('update:expandedKeys')?.[0]?.[0] as string[])).toContain('1');
    expect(rows(wrapper)).toHaveLength(4);
  });

  it('受控 expandedKeys 由外层决定渲染', async () => {
    const wrapper = mount(Tree, {
      props: { expandedKeys: ['2'], fieldNames, treeData },
    });
    expect(rows(wrapper)).toHaveLength(2);
    await wrapper.setProps({ expandedKeys: [1] });
    expect(rows(wrapper)).toHaveLength(4);
  });

  it('点节点抛出 select，携带原始数据', async () => {
    const wrapper = mount(Tree, { props: { fieldNames, treeData } });
    await rows(wrapper)[1]!.trigger('click');
    const emitted = wrapper.emitted('select')?.[0];
    expect(emitted?.[0]).toEqual([2]);
    expect((emitted?.[1] as { node: { name: string } }).node.name).toBe('分部');
  });

  it('checkable 勾父带子，再点取消整棵', async () => {
    const wrapper = mount(Tree, {
      props: { checkable: true, defaultExpandAll: true, fieldNames, treeData },
    });
    await boxes(wrapper)[0]!.trigger('click');
    const first = wrapper.emitted('check')?.[0]?.[0] as (number | string)[];
    expect(first.map(String).sort()).toEqual(['1', '11', '12', '121']);

    await boxes(wrapper)[0]!.trigger('click');
    const second = wrapper.emitted('check')?.[1]?.[0] as (number | string)[];
    expect(second).toHaveLength(0);
  });

  it('子树全选时父节点自动进入 checkedKeys', async () => {
    const wrapper = mount(Tree, {
      props: { checkable: true, defaultExpandAll: true, fieldNames, treeData },
    });
    await boxes(wrapper)[1]!.trigger('click');
    await boxes(wrapper)[2]!.trigger('click');
    const keys = wrapper.emitted('check')?.[1]?.[0] as (number | string)[];
    expect(keys.map(String)).toContain('1');
  });

  it('子树部分选中时父节点呈半选', async () => {
    const wrapper = mount(Tree, {
      props: { checkable: true, defaultExpandAll: true, fieldNames, treeData },
    });
    await boxes(wrapper)[1]!.trigger('click');
    const root = wrapper.findAll('[data-common-tree-node]')[0]!;
    expect(
      root.find('[data-common-tree-checkbox] button').attributes('data-state')
    ).toBe('indeterminate');
  });
});
