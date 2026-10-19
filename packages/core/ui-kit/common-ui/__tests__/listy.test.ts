import type { ListyItem } from '../src/components/listy/types';

import { mount } from '@vue/test-utils';
import { h } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import Listy from '../src/components/listy/Listy.vue';

const ITEMS = [
  {
    description: '已完成 12 条同步',
    extra: '3 分钟前',
    icon: 'carbon:document',
    title: '数据同步',
  },
  { title: '日志清理' },
];

const mountList = (options: Record<string, unknown> = {}) =>
  mount(Listy, { props: { items: ITEMS }, ...options });

const rowsOf = (wrapper: ReturnType<typeof mountList>) =>
  wrapper.findAll('ul > li');

describe('Listy', () => {
  it('基础渲染：标题、描述、行尾次要内容与行首图标位', () => {
    const wrapper = mountList();
    const first = rowsOf(wrapper)[0]!;
    expect(first.text()).toContain('数据同步');
    expect(first.text()).toContain('已完成 12 条同步');
    expect(first.text()).toContain('3 分钟前');
    // 第二行只有标题：可选片段留不下正文
    const second = rowsOf(wrapper)[1]!;
    expect(second.text().trim()).toBe('日志清理');
    expect(rowsOf(wrapper)).toHaveLength(2);
  });

  it('空数组走空状态，文案与图标可配', () => {
    expect(mountList({ props: { items: [] } }).text()).toContain('暂无数据');
    expect(
      mountList({ props: { emptyText: '还没有任务', items: [] } }).text(),
    ).toContain('还没有任务');
  });

  it('#empty 插槽顶掉默认空状态', () => {
    const wrapper = mount(Listy, {
      props: { items: [] },
      slots: { empty: '<b class="custom">自定义空态</b>' },
    });
    expect(wrapper.find('b.custom').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('暂无数据');
  });

  it('loading 用骨架行占位，行数可配且不渲染正文', () => {
    const wrapper = mountList({ props: { items: ITEMS, loading: true } });
    expect(wrapper.find('ul').attributes('aria-busy')).toBe('true');
    expect(rowsOf(wrapper)).toHaveLength(3);
    expect(wrapper.text()).not.toContain('数据同步');
    expect(
      rowsOf(
        mountList({
          props: { items: ITEMS, loading: true, loadingRows: 5 },
        }),
      ),
    ).toHaveLength(5);
  });

  it('#item 插槽整行接管', () => {
    const wrapper = mount(Listy, {
      props: { items: ITEMS },
      slots: {
        item: ({ index, item }: { index: number; item: ListyItem }) =>
          h('i', { class: 'row' }, `${index}:${item.title}`),
      },
    });
    expect(wrapper.find('i.row').text()).toBe('0:数据同步');
    expect(wrapper.text()).not.toContain('3 分钟前');
  });

  it('#item-extra 只换行尾那一段', () => {
    const wrapper = mount(Listy, {
      props: { items: ITEMS },
      slots: {
        'item-extra': ({ item }: { item: ListyItem }) =>
          h('em', `${item.extra}!`),
      },
    });
    expect(wrapper.find('em').text()).toBe('3 分钟前!');
    expect(wrapper.text()).toContain('数据同步');
  });

  it('#header / #footer 缺席时整块不渲染', () => {
    expect(mountList().findAll('.listy__header, .listy__footer')).toHaveLength(0);
    const withHead = mount(Listy, {
      props: { items: ITEMS },
      slots: { footer: '<span>共 2 条</span>', header: '<span>任务列表</span>' },
    });
    expect(withHead.findAll('.listy__header, .listy__footer')).toHaveLength(2);
    expect(withHead.text()).toContain('任务列表');
    expect(withHead.text()).toContain('共 2 条');
  });

  it('点击行抛出 item-click(item, index)', async () => {
    const wrapper = mountList();
    await rowsOf(wrapper)[1]!.trigger('click');
    expect(wrapper.emitted('itemClick')?.[0]).toEqual([ITEMS[1], 1]);
  });

  it('selectable 才给行加"可点"的视觉暗示', () => {
    expect(mountList().find('ul > li').classes()).not.toContain('cursor-pointer');
    const wired = mount(Listy, {
      props: { items: ITEMS, selectable: true },
    });
    expect(wired.find('ul > li').classes()).toContain('cursor-pointer');
  });

  it('itemKey 支持字段名与取值函数两种写法', () => {
    const data = [
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
    ];
    const pick = vi.fn((index: number, item: Record<string, unknown>) =>
      String(item.id ?? index),
    );
    expect(rowsOf(mount(Listy, { props: { itemKey: 'id', items: data } }))).toHaveLength(2);
    const byFn = mount(Listy, { props: { itemKey: pick, items: data } });
    expect(pick).toHaveBeenCalledWith(0, data[0]);
    expect(pick).toHaveBeenCalledWith(1, data[1]);
    expect(rowsOf(byFn)).toHaveLength(2);
  });

  it('调用方传 list 工具类时，钩子类不会被 tailwind-merge 吃掉', () => {
    expect(mountList({ props: { class: 'list-none' } }).classes()).toContain(
      'listy',
    );
  });

  it('size 换的是行的紧凑程度', () => {    expect(mountList().find('ul > li').classes()).toContain('px-4');
    expect(
      mountList({ props: { items: ITEMS, size: 'small' } }).find('ul > li').classes(),
    ).toContain('px-3');
    expect(
      mountList({ props: { items: ITEMS, size: 'large' } }).find('ul > li').classes(),
    ).toContain('py-4');
  });
});
