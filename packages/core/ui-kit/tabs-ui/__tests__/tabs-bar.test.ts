import type { TabItem } from '@antdv/types';

import type { TabActionContext } from '../src/types';

import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import TabActions from '../src/components/TabActions.vue';
import TabContextMenu from '../src/components/TabContextMenu.vue';
import { configureTabs } from '../src/config';
import TabsBar from '../src/TabsBar.vue';

/**
 * 标签条与两个"菜单"入口的 DOM 测试。
 *
 * 动作能不能点是纯数据判断（见 actions-and-style），这里只验接线：
 * 上下文算得对不对、事件是否带着目标 key 冒到使用方、
 * 右键菜单的开合与边缘收口。reka 的浮层与右键菜单都落在 body 上，
 * 所以断言一律 `document.body.querySelector`。
 */

const fakeT = (key: string, named?: Record<string, number | string>) =>
  named ? `${key}(${named.count})` : key;

const tabs = (): TabItem[] => [
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

/**
 * 本条用例里挂上去的所有实例。teleport 到 body 的菜单只有卸载组件才会消失，
 * 只清 `document.body.innerHTML` 会留下还活着的实例，下一条用例一查就串台。
 */
const mounted: Array<{ unmount: () => void }> = [];

function track<T extends { unmount: () => void }>(wrapper: T): T {
  mounted.push(wrapper);
  return wrapper;
}

/**
 * 上下文的最小可用形态：按需覆盖单个字段，其余为"什么都没有"。
 * 传进组件的是这个对象，动作集由组件自己现算。
 */
const context = (overrides: Partial<TabActionContext> = {}): TabActionContext => ({
  affixed: false,
  closeableLeft: 0,
  closeableRight: 0,
  isHome: false,
  maximized: false,
  others: 0,
  ...overrides,
});

/**
 * 两个菜单入口的禁用标记不一样：自绘右键菜单用原生 `disabled`，
 * reka 的下拉用 `data-disabled`，所以断言分开写，别指望一个选择器通吃。
 */
function menuItems(): HTMLElement[] {
  return [
    ...document.body.querySelectorAll<HTMLElement>(
      '[role="menu"] [role="menuitem"]',
    ),
  ];
}

beforeEach(() => {
  configureTabs({ t: fakeT });
});

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = '';
});

describe('TabContextMenu —— 右键菜单', () => {
  function mountMenu(payload: any, ctx: Partial<TabActionContext> = {}) {
    return track(
      mount(TabContextMenu as any, {
        props: { context: context(ctx), payload },
      }),
    );
  }

  it('payload 为空时什么都不渲染', () => {
    mountMenu(null);
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
  });

  it('打开后按动作集渲染菜单项，分隔线不是可点项', () => {
    mountMenu({ key: 'a', x: 40, y: 40 });
    const menu = document.body.querySelector('[role="menu"]');
    expect(menu).not.toBeNull();
    // 10 项定义里 1 条分隔线 → 9 个按钮 + 1 个分隔条
    expect(menuItems()).toHaveLength(9);
    expect(menu?.querySelectorAll('.my-1')).toHaveLength(1);
  });

  it('位置跟随点击点', () => {
    mountMenu({ key: 'a', x: 40, y: 40 });
    const menu = document.body.querySelector<HTMLElement>('[role="menu"]');
    expect(menu?.style.left).toBe('40px');
    expect(menu?.style.top).toBe('40px');
  });

  it('贴近视口右下角时自动收口，不被裁掉', () => {
    mountMenu({ key: 'a', x: window.innerWidth, y: window.innerHeight });
    const menu = document.body.querySelector<HTMLElement>('[role="menu"]');
    expect(menu?.style.left).toBe(`${window.innerWidth - 176 - 8}px`);
    expect(menu?.style.top).toBe(`${window.innerHeight - 330 - 8}px`);
  });

  it('点菜单项把动作 key 与命中的标签 key 一起抛出，并关闭菜单', async () => {
    const wrapper = mountMenu({ key: 'b', x: 20, y: 20 });
    const refresh = menuItems().find((item) =>
      item.textContent?.includes('tabs.refreshCurrent'),
    );
    refresh?.click();
    await nextTick();

    expect(wrapper.emitted('action')?.[0]).toEqual(['refresh', 'b']);
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('禁用项点不动（首页的 affix 与固定标签的 close）', async () => {
    const wrapper = mountMenu({ key: 'home', x: 20, y: 20 }, {
      affixed: true,
      isHome: true,
    });
    const items = menuItems();
    const affix = items.find((item) =>
      item.textContent?.includes('tabs.affixOff'),
    );
    const close = items.find((item) =>
      item.textContent?.includes('tabs.closeCurrent'),
    );
    expect(affix?.hasAttribute('disabled')).toBe(true);
    expect(close?.hasAttribute('disabled')).toBe(true);
    affix?.click();
    close?.click();
    await nextTick();
    expect(wrapper.emitted('action')).toBeUndefined();
  });

  it('菜单外按下、Esc、窗口失焦都会关闭；菜单内点击不关', async () => {
    const wrapper = mountMenu({ key: 'a', x: 20, y: 20 });
    await nextTick();

    document.body.querySelector('[role="menu"]')
      ?.querySelector('button')
      ?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    await nextTick();
    expect(wrapper.emitted('close')).toBeUndefined();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTick();
    expect(wrapper.emitted('close')).toHaveLength(1);

    window.dispatchEvent(new Event('blur'));
    await nextTick();
    expect(wrapper.emitted('close')).toHaveLength(2);

    document.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    await nextTick();
    expect(wrapper.emitted('close')).toHaveLength(3);
  });

  it('卸载后摘掉全局监听，不会再抛 close', async () => {
    const wrapper = mountMenu({ key: 'a', x: 20, y: 20 });
    wrapper.unmount();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTick();
    expect(wrapper.emitted('close')).toBeUndefined();
  });
});

describe('TabActions —— 右上角下拉', () => {
  function mountActions(ctx: Partial<TabActionContext> = {}) {
    return track(
      mount(TabActions as any, {
        // 挂到 body 上：reka 的下拉要靠 trigger 的真实 DOM 事件才能打开
        attachTo: document.body,
        props: { context: context(ctx) },
      }),
    );
  }

  it('触发按钮有可访问名字', () => {
    const wrapper = mountActions();
    const trigger = wrapper.find('button');
    expect(trigger.attributes('aria-label')).toBe('shell.tabActions');
  });

  it('点击展开菜单，选项与动作集一致，选中后抛出动作 key', async () => {
    const wrapper = mountActions();
    await wrapper.find('button').trigger('click');
    await nextTick();

    const items = menuItems();
    expect(items.map((item) => item.textContent?.trim())).toEqual([
      'tabs.closeCurrent',
      'tabs.affix',
      'tabs.maximize',
      'tabs.refreshCurrent',
      'tabs.openInNewWindow',
      'tabs.closeOther',
      'tabs.closeLeft',
      'tabs.closeRight',
      'tabs.closeAll',
    ]);

    items[3]?.click();
    await nextTick();
    expect(wrapper.emitted('action')?.[0]).toEqual(['refresh']);
  });

  it('禁用项在菜单里就是禁用态', async () => {
    const wrapper = mountActions({ affixed: true, isHome: true });
    await wrapper.find('button').trigger('click');
    await nextTick();

    // reka 的菜单项是 div[role=menuitem]，禁用靠 `data-disabled` 标记
    expect(menuItems()).toHaveLength(9);
    const find = (label: string) =>
      menuItems().find((item) => item.textContent?.includes(label));
    expect(find('tabs.closeCurrent')?.hasAttribute('data-disabled')).toBe(true);
    expect(find('tabs.refreshCurrent')?.hasAttribute('data-disabled')).toBe(
      false,
    );
  });
});

describe('TabsBar —— 标签宿主条', () => {
  function mountBar(props: Record<string, any> = {}) {
    return track(
      mount(TabsBar as any, {
        props: { activeKey: 'a', tabs: tabs(), ...props },
        attachTo: document.body,
      }),
    );
  }

  it('渲染标签条本体，选中项带 data-active', () => {
    const wrapper = mountBar();
    const bar = wrapper.find('.tab-bar');
    expect(bar.exists()).toBe(true);
    expect(wrapper.findAll('.tab-item')).toHaveLength(3);
    expect(
      wrapper.findAll('.tab-item').map((item) => item.attributes('data-active')),
    ).toEqual(['false', 'true', 'false']);
  });

  it('明暗主题下的底色，geek 主题走固定深色', () => {
    const normal = mountBar();
    expect(normal.find('.tab-bar').classes()).toContain('bg-white');

    const geek = mountBar({ themeStyle: 'geek' });
    expect(geek.find('.tab-bar').classes()).toContain('bg-[#0a0a0a]');
  });

  it('风格偏好落到容器与标签类名上（chrome 把标签压到底边）', () => {
    const wrapper = mountBar({ tabStyle: 'chrome' });
    const bar = wrapper.find('.tab-bar');
    expect(bar.classes()).toContain('items-stretch');
    expect(wrapper.find('.tab-list').classes()).toContain('items-end');
  });

  it('左右滚动箭头默认不显示（没有溢出）', () => {
    const wrapper = mountBar();
    // 按 aria-label 选箭头：动作按钮同样是 .tab-bar 的直接子节点
    const arrows = [
      wrapper.find('[aria-label="shell.scrollTabsLeft"]'),
      wrapper.find('[aria-label="shell.scrollTabsRight"]'),
    ];
    expect(arrows.map((arrow) => arrow.attributes('style') ?? '')).toEqual([
      'display: none;',
      'display: none;',
    ]);
  });

  it('点击标签抛 activate，点关闭抛 close，都不带别的动作', async () => {
    const wrapper = mountBar();
    await wrapper.findAll('.tab-item')[2]?.trigger('click');
    expect(wrapper.emitted('activate')?.[0]).toEqual(['b']);

    await wrapper.findAll('.tab-item')[1]
      ?.find('.tab-item__close')
      .trigger('click');
    expect(wrapper.emitted('close')?.[0]).toEqual(['a']);
  });

  it('showIcon 只管标签图标，关闭按钮照常画；draggable 透传给列表', () => {
    // 只有 b 配了图标，a/b 可关闭 → 图标 1 个 + 关闭 2 个
    const withIcon = mountBar();
    expect(withIcon.findAll('.tab-item svg')).toHaveLength(3);

    const wrapper = mountBar({ draggable: false, showIcon: false });
    expect(wrapper.findAll('.tab-item svg')).toHaveLength(2);
    expect(wrapper.findComponent({ name: 'TabList' }).props('draggable')).toBe(
      false,
    );
  });

  it('拖拽排序的结果原样上报给使用方', async () => {
    const wrapper = mountBar();
    wrapper.findComponent({ name: 'TabList' }).vm.$emit('reorder', [
      { key: 'a' },
      { key: 'b' },
      { key: 'home' },
    ]);
    await nextTick();
    expect(wrapper.emitted('reorder')?.[0]?.[0]).toMatchObject([
      { key: 'a' },
      { key: 'b' },
      { key: 'home' },
    ]);
  });

  it('右键标签打开菜单，动作带着命中的标签 key', async () => {
    const wrapper = mountBar();
    await wrapper.findAll('.tab-item')[2]?.trigger('contextmenu');
    await nextTick();

    expect(document.body.querySelector('[role="menu"]')).not.toBeNull();

    const closeOther = menuItems().find((item) =>
      item.textContent?.includes('tabs.closeOther'),
    );
    closeOther?.click();
    await nextTick();
    // 命中的是 b（第 3 个），右侧无可关闭标签 → label 带数量 0 时不加计数
    expect(wrapper.emitted('action')?.[0]).toEqual(['closeOther', 'b']);
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
  });

  it('contextMenu 关掉后右键不再弹菜单', async () => {
    const wrapper = mountBar({ contextMenu: false });
    await wrapper.findAll('.tab-item')[1]?.trigger('contextmenu');
    await nextTick();
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
  });

  it('上下文由标签数组现算：首页禁固定与关闭，批量项带上数量', async () => {
    // 激活 b（第 3 个），但右键第 1 个（home）→ 目标以命中的标签为准
    const wrapper = mountBar({ activeKey: 'b' });
    await wrapper.findAll('.tab-item')[0]?.trigger('contextmenu');
    await nextTick();

    const items = menuItems();
    const label = (key: string) =>
      items.find((item) => item.textContent?.trim().startsWith(key));
    expect(items.map((item) => item.textContent?.trim())).toEqual([
      'tabs.closeCurrent',
      'tabs.affixOff',
      'tabs.maximize',
      'tabs.refreshCurrent',
      'tabs.openInNewWindow',
      'tabs.closeOtherCount(2)',
      'tabs.closeLeft',
      'tabs.closeRightCount(2)',
      'tabs.closeAll',
    ]);
    // home：固定区锚点 → close 与 affix 都禁用；左侧数不出可关闭标签 → closeLeft 禁用
    // 自绘右键菜单是原生 button，禁用直接看 disabled 属性
    expect(label('tabs.closeCurrent')?.hasAttribute('disabled')).toBe(true);
    expect(label('tabs.affixOff')?.hasAttribute('disabled')).toBe(true);
    expect(label('tabs.closeLeft')?.hasAttribute('disabled')).toBe(true);
    expect(label('tabs.closeAll')?.hasAttribute('disabled')).toBe(false);
  });

  it('maximizedKey 命中目标标签时，放大项换成还原文案', async () => {
    const wrapper = mountBar({ maximizedKey: 'a' });
    await wrapper.findAll('.tab-item')[1]?.trigger('contextmenu');
    await nextTick();
    const labels = menuItems().map((item) => item.textContent?.trim());
    expect(labels).toContain('tabs.maximizeOff');
  });

  it('右上角动作不带标签 key：缺省即表示以当前激活标签为目标', async () => {
    const wrapper = mountBar();
    wrapper
      .findComponent({ name: 'TabActions' })
      .vm.$emit('action', 'refresh');
    await nextTick();
    expect(wrapper.emitted('action')?.[0]).toEqual(['refresh']);
  });
});
