import type { TabItem as TabItemData } from '@antdv/types';

import { mount } from '@vue/test-utils';
import { nextTick, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import TabItem from '../src/components/TabItem.vue';
import TabList from '../src/components/TabList.vue';
import { moveTab, useTabDragSort } from '../src/useTabDragSort';

/**
 * 标签本体与标签列表的渲染/交互测试。
 *
 * Sortable 在 jsdom 里不会真的搬动 DOM 节点，所以这里记录传入的选项，
 * 由用例自己模拟「节点已被拖拽库挪走」的现场，再触发回调验证：
 * 先还原 DOM、再上报新顺序 —— 这条链路是整个拖拽实现的关键。
 */
const instances: Array<{
  destroy: ReturnType<typeof vi.fn>;
  el: HTMLElement;
  option: ReturnType<typeof vi.fn>;
  options: any;
}> = [];

/**
 * 拖拽库的替身：实现里是 `new Sortable(el, options)`，所以必须是能当构造函数用的
 * 具名函数声明（箭头函数不能 new）。实例只把选项记下来，供用例手动触发回调。
 */
function FakeSortable(this: any, el: HTMLElement, options: any) {
  const record = {
    destroy: vi.fn(),
    el,
    option: vi.fn(),
    options,
  };
  instances.push(record as any);
  return { destroy: record.destroy, option: record.option };
}

vi.mock('sortablejs', () => ({ default: vi.fn(FakeSortable) }));

const tabs = (): TabItemData[] => [
  { affix: true, closable: false, key: 'home', path: '/home', title: '首页' },
  { closable: true, key: 'a', path: '/a', title: '标签 A' },
  {
    closable: true,
    icon: 'carbon:document',
    key: 'b',
    path: '/b',
    title: '标签 B',
  },
];

function mountList(props: Record<string, any> = {}) {
  return mount(TabList as any, {
    props: {
      activeKey: 'a',
      affixCount: 1,
      closeClass: 'text-xs',
      itemClass: (active: boolean) => (active ? 'is-active' : 'is-idle'),
      listClass: 'flex',
      showIcon: true,
      tabs: tabs(),
      ...props,
    },
  });
}

beforeEach(() => {
  instances.length = 0;
});

describe('tabItem —— 单个标签的渲染', () => {
  it('标题、data 钩子与选中态都在', () => {
    const wrapper = mount(TabItem as any, {
      props: {
        active: true,
        closable: true,
        closeClass: 'text-xs',
        itemClass: 'is-active',
        showIcon: false,
        tab: tabs()[1]!,
      },
    });
    const item = wrapper.find('.tab-item');
    expect(item.text()).toBe('标签 A');
    expect(item.attributes('data-active')).toBe('true');
    expect(item.attributes('data-scroll-key')).toBe('a');
    expect(item.classes()).toContain('is-active');
  });

  it('showIcon 与 tab.icon 同时为真才画图标', () => {
    const withIcon = mount(TabItem as any, {
      props: {
        active: false,
        closable: false,
        closeClass: '',
        itemClass: '',
        showIcon: true,
        tab: tabs()[2]!,
      },
    });
    expect(withIcon.find('svg').exists()).toBe(true);

    const noIcon = mount(TabItem as any, {
      props: {
        active: false,
        closable: false,
        closeClass: '',
        itemClass: '',
        showIcon: false,
        tab: tabs()[2]!,
      },
    });
    expect(noIcon.find('svg').exists()).toBe(false);
  });

  it('closable 为假时没有关闭按钮', () => {
    const wrapper = mount(TabItem as any, {
      props: {
        active: false,
        closable: false,
        closeClass: '',
        itemClass: '',
        showIcon: false,
        tab: tabs()[1]!,
      },
    });
    expect(wrapper.find('.tab-item__close').exists()).toBe(false);
  });

  it('点标签抛 key，点关闭只抛 close（.stop 不会顺带激活标签）', async () => {
    const wrapper = mount(TabItem as any, {
      props: {
        active: false,
        closable: true,
        closeClass: '',
        itemClass: '',
        showIcon: false,
        tab: tabs()[1]!,
      },
    });
    await wrapper.find('.tab-item').trigger('click');
    expect(wrapper.emitted('click')?.[0]).toEqual(['a']);

    await wrapper.find('.tab-item__close').trigger('click');
    expect(wrapper.emitted('close')?.[0]).toEqual(['a']);
    // 上一次的 click 之后没有新的 click 冒泡上来
    expect(wrapper.emitted('click')).toHaveLength(1);
  });

  it('右键抛出事件与 key，并阻止浏览器默认菜单', async () => {
    const wrapper = mount(TabItem as any, {
      props: {
        active: false,
        closable: true,
        closeClass: '',
        itemClass: '',
        showIcon: false,
        tab: tabs()[1]!,
      },
    });
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 120,
      clientY: 60,
    });
    wrapper.find('.tab-item').element.dispatchEvent(event);
    await nextTick();

    expect(wrapper.emitted('contextmenu')?.[0]?.[1]).toBe('a');
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('tabList —— 列表渲染与事件透传', () => {
  it('按 tabs 顺序渲染，选中项拿到 active 类名', () => {
    const wrapper = mountList();
    const items = wrapper.findAll('.tab-item');
    expect(items).toHaveLength(3);
    expect(items.map((item) => item.text())).toEqual([
      '首页',
      '标签 A',
      '标签 B',
    ]);
    expect(items[0]?.classes()).toContain('is-idle');
    expect(items[1]?.classes()).toContain('is-active');
  });

  it('只有固定标签不画关闭按钮，普通标签即使只剩一个也可关', () => {
    const wrapper = mountList();
    // 3 个标签、1 个固定 → 非固定项可关
    expect(
      wrapper
        .findAll('.tab-item')
        .map((item) => item.find('.tab-item__close').exists()),
    ).toEqual([false, true, true]);

    const onlyHome = mountList({
      activeKey: 'home',
      affixCount: 1,
      tabs: [tabs()[0]],
    });
    expect(onlyHome.find('.tab-item__close').exists()).toBe(false);

    // 与旧实现同源：可关判定只看「不是固定标签，且标签数多于固定数」，
    // 唯一的那个普通标签关掉后由数据源补回，不在渲染层额外设限。
    const single = mountList({ affixCount: 0, tabs: [tabs()[1]] });
    expect(single.find('.tab-item__close').exists()).toBe(true);
  });

  it('点击/关闭/右键逐个透传 key', async () => {
    const wrapper = mountList();
    await wrapper.findAll('.tab-item')[2]?.trigger('click');
    expect(wrapper.emitted('activate')?.[0]).toEqual(['b']);

    await wrapper
      .findAll('.tab-item')[1]
      ?.find('.tab-item__close')
      .trigger('click');
    expect(wrapper.emitted('close')?.[0]).toEqual(['a']);

    await wrapper.findAll('.tab-item')[0]?.trigger('contextmenu');
    expect(wrapper.emitted('contextmenu')?.[0]?.[1]).toBe('home');
  });

  it('容器带上 tab-list 与传入的风格类名', () => {
    const wrapper = mountList({ listClass: 'gap-2' });
    const list = wrapper.find('.tab-list');
    expect(list.classes()).toEqual(['tab-list', 'gap-2']);
  });
});

describe('tabList —— 拖拽排序接线', () => {
  it('挂载后把 Sortable 绑在容器上，默认不禁用', () => {
    const wrapper = mountList();
    expect(instances).toHaveLength(1);
    expect(instances[0]?.el).toBe(wrapper.find('.tab-list').element);
    expect(instances[0]?.options.disabled).toBe(false);
    expect(instances[0]?.options.animation).toBe(180);
    expect(instances[0]?.options.ghostClass).toBe('tab-ghost');
    wrapper.unmount();
  });

  it('draggable 关掉时同步 Sortable 的 disabled 选项', async () => {
    const wrapper = mountList();
    await wrapper.setProps({ draggable: false });
    expect(instances[0]?.option).toHaveBeenCalledWith('disabled', true);
    await wrapper.setProps({ draggable: true });
    expect(instances[0]?.option).toHaveBeenCalledWith('disabled', false);
    wrapper.unmount();
  });

  it('卸载时销毁实例', () => {
    const wrapper = mountList();
    wrapper.unmount();
    expect(instances[0]?.destroy).toHaveBeenCalledTimes(1);
  });

  /**
   * 模拟真实拖拽：先把节点搬走（Sortable 干的），再触发 onEnd。
   * 用例断言 DOM 被还原成拖拽前的顺序，同时 reorder 抛出完整新数组 ——
   * 顺序的真相只有数据源一份，否则 Vue 的 patch 会与真实 DOM 打架。
   */
  it('onEnd 先还原 DOM 再上报新顺序', async () => {
    const wrapper = mountList();
    const list = wrapper.find('.tab-list').element;
    const nodes = [...list.children] as HTMLElement[];
    // 每次都现量容器子节点，才是"真实 DOM 的顺序"
    const keys = () =>
      [...list.children].map((node) => (node as HTMLElement).dataset.scrollKey);

    expect(keys()).toEqual(['home', 'a', 'b']);

    // 把 b 挪到第 0 位
    list.insertBefore(nodes[2]!, nodes[0] ?? null);
    expect(keys()).toEqual(['b', 'home', 'a']);

    instances[0]?.options.onEnd({
      from: list,
      item: nodes[2],
      newIndex: 0,
      oldIndex: 2,
      to: list,
    });

    expect(keys()).toEqual(['home', 'a', 'b']);
    expect(wrapper.emitted('reorder')?.[0]?.[0]).toMatchObject([
      { key: 'b' },
      { key: 'home' },
      { key: 'a' },
    ]);
    wrapper.unmount();
  });

  it('前移方向同样能还原 DOM', () => {
    const wrapper = mountList();
    const list = wrapper.find('.tab-list').element;
    const nodes = [...list.children] as HTMLElement[];

    // 把 a（下标 1）拖到最后一位
    list.append(nodes[1]!);
    expect(
      [...list.children].map((node) => (node as HTMLElement).dataset.scrollKey),
    ).toEqual(['home', 'b', 'a']);

    instances[0]?.options.onEnd({
      from: list,
      item: nodes[1],
      newIndex: 2,
      oldIndex: 1,
      to: list,
    });

    expect(
      [...list.children].map((node) => (node as HTMLElement).dataset.scrollKey),
    ).toEqual(['home', 'a', 'b']);
    expect(wrapper.emitted('reorder')?.[0]?.[0]).toMatchObject([
      { key: 'home' },
      { key: 'b' },
      { key: 'a' },
    ]);
    wrapper.unmount();
  });

  it('原地松手（新旧下标相同）只还原 DOM，不抛 reorder', () => {
    const wrapper = mountList();
    const list = wrapper.find('.tab-list').element;
    const nodes = [...list.children] as HTMLElement[];

    instances[0]?.options.onEnd({
      from: list,
      item: nodes[1],
      newIndex: 1,
      oldIndex: 1,
      to: list,
    });
    expect(wrapper.emitted('reorder')).toBeUndefined();
    wrapper.unmount();
  });

  it('固定标签区是禁区：拖出或拖入都不允许', () => {
    const wrapper = mountList({ affixCount: 1 });
    const list = wrapper.find('.tab-list').element;
    const nodes = [...list.children] as HTMLElement[];
    const onMove = instances[0]?.options.onMove;

    // 拖固定标签本身
    expect(
      onMove({ dragged: nodes[0], from: list, related: nodes[1], to: list }),
    ).toBe(false);
    // 落点越过固定区
    expect(
      onMove({ dragged: nodes[1], from: list, related: nodes[0], to: list }),
    ).toBe(false);
    // 两个非固定标签之间
    expect(
      onMove({ dragged: nodes[1], from: list, related: nodes[2], to: list }),
    ).toBe(true);
    wrapper.unmount();
  });

  it('没有固定标签时不做任何限制', () => {
    const wrapper = mountList({ affixCount: 0 });
    const list = wrapper.find('.tab-list').element;
    const nodes = [...list.children] as HTMLElement[];
    expect(
      instances[0]?.options.onMove({
        dragged: nodes[0],
        from: list,
        related: nodes[2],
        to: list,
      }),
    ).toBe(true);
    wrapper.unmount();
  });
});

describe('moveTab —— 顺序换算', () => {
  const list = tabs();

  it('返回新数组，不改原数组', () => {
    const next = moveTab(list, 0, 2);
    expect(next?.map((tab) => tab.key)).toEqual(['a', 'b', 'home']);
    expect(list.map((tab) => tab.key)).toEqual(['home', 'a', 'b']);
  });

  it('原地不动或下标越界返回 null', () => {
    expect(moveTab(list, 1, 1)).toBeNull();
    expect(moveTab(list, -1, 1)).toBeNull();
    expect(moveTab(list, 0, 3)).toBeNull();
  });
});

describe('useTabDragSort —— 脱离组件的接线', () => {
  it('同一元素重复 init 只创建一个实例', () => {
    const ctl = ref<any>(null);
    mount(
      {
        setup() {
          ctl.value = useTabDragSort({
            affixCount: () => 0,
            onReorder: vi.fn(),
            tabs: () => tabs(),
          });
          return () => null;
        },
      },
      { attachTo: document.body },
    );

    const el = document.createElement('div');
    ctl.value.initSortable(el);
    ctl.value.initSortable(el);
    expect(instances).toHaveLength(1);
    expect(instances[0]?.el).toBe(el);
  });

  it('创建时就带上 isDisabled 的当前值', () => {
    const disabled = ref(true);
    const ctl = ref<any>(null);
    mount(
      {
        setup() {
          ctl.value = useTabDragSort({
            affixCount: () => 1,
            animation: 120,
            isDisabled: () => disabled.value,
            onReorder: vi.fn(),
            tabs: () => tabs(),
          });
          return () => null;
        },
      },
      { attachTo: document.body },
    );

    const el = document.createElement('div');
    ctl.value.initSortable(el);
    expect(instances[0]?.options.disabled).toBe(true);
    expect(instances[0]?.options.animation).toBe(120);
  });
});
