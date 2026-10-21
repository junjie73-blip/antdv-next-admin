import type { MenuConfig } from '@antdv/types';

import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import BasicMenu from '../src/BasicMenu.vue';
import { configureMenu, menuRuntime } from '../src/config';

/** 与 menu-tree 测试同一棵树：目录 → 子目录 → 叶子（三级） */
const tree: MenuConfig[] = [
  {
    children: [
      {
        children: [
          { name: 'BasicForm', path: '/demo/form/basic', title: '基础表单' },
          {
            disabled: true,
            name: 'StepForm',
            path: '/demo/form/step',
            title: '分步表单',
          },
        ],
        name: 'DemoForm',
        path: '',
        title: '表单',
      },
      {
        isExternal: true,
        name: 'AntdvDoc',
        path: 'https://antdv-next.com',
        title: '组件文档',
      },
    ],
    icon: 'carbon:apps',
    name: 'Demo',
    path: '',
    title: '组件示例',
  },
  {
    badge: { dot: true },
    name: 'Dashboard',
    path: '/dashboard',
    title: '分析面板',
  },
  { extra: '3', name: 'Notice', path: '/notice', title: '通知' },
  { extra: true, name: 'Flag', path: '/flag', title: '布尔附加' },
  { hidden: true, name: 'Secret', path: '/secret', title: '隐藏页' },
];

/**
 * 浮层内容经 reka 的 Portal 挂到 `body`，只 unmount 外壳不会消失；
 * 留下一份注册表，收尾时统一卸载，否则后一条用例会在 body 里捞到前一条的浮层。
 */
const mounted: Array<{ unmount: () => void }> = [];

function mountMenu(props: Record<string, unknown> = {}) {
  const wrapper = mount(BasicMenu, {
    attachTo: document.body,
    props: { menus: tree, ...props },
  });
  mounted.push(wrapper);
  return wrapper;
}

/** 顶层行（不含展开后的子行） */
function topRows(wrapper: ReturnType<typeof mountMenu>) {
  return wrapper.findAll('[data-menu-variant="inline"] > li > [data-menu-key]');
}

function rows(wrapper: ReturnType<typeof mountMenu>) {
  return wrapper.findAll('[data-menu-key]');
}

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = '';
  configureMenu({ t: (key: string) => key });
});

describe('basicMenu —— 内联形态', () => {
  it('只画可见项，且未展开的目录不带子行', () => {
    const wrapper = mountMenu();
    const keys = topRows(wrapper).map((row) => row.attributes('data-menu-key'));
    expect(keys).toEqual(['Demo', 'Dashboard', 'Notice', 'Flag']);
    expect(rows(wrapper)).toHaveLength(4);
  });

  it('openKeys 展开目录后子行才出现，并带 role=group 容器', () => {
    const wrapper = mountMenu({ openKeys: ['Demo'] });
    expect(wrapper.find('[data-menu-submenu]').exists()).toBe(true);
    const keys = rows(wrapper).map((row) => row.attributes('data-menu-key'));
    expect(keys).toEqual([
      'Demo',
      'DemoForm',
      'AntdvDoc',
      'Dashboard',
      'Notice',
      'Flag',
    ]);
  });

  it('点目录上抛展开状态，不导航', async () => {
    const wrapper = mountMenu();
    await topRows(wrapper)[0]!.trigger('click');
    expect(wrapper.emitted('update:openKeys')).toEqual([[['Demo']]]);
    expect(wrapper.emitted('select')).toBeUndefined();

    // 再点一次收起：受控语义，包内不记状态
    const opened = mountMenu({ openKeys: ['Demo'] });
    await topRows(opened)[0]!.trigger('click');
    expect(opened.emitted('update:openKeys')).toEqual([[[]]]);
  });

  it('点叶子上抛 key，不动 openKeys', async () => {
    const wrapper = mountMenu({ openKeys: ['Demo', 'DemoForm'] });
    const leaf = wrapper
      .findAll('[data-menu-key]')
      .find((row) => row.attributes('data-menu-key') === 'BasicForm');
    await leaf!.trigger('click');
    expect(wrapper.emitted('select')).toEqual([['BasicForm']]);
    expect(wrapper.emitted('update:openKeys')).toBeUndefined();
  });

  it('选中项：高亮标记 + 左侧竖条 + aria-current', () => {
    const wrapper = mountMenu({
      openKeys: ['Demo', 'DemoForm'],
      selectedKeys: ['BasicForm'],
    });
    const selected = wrapper.findAll('[data-menu-state="selected"]');
    expect(selected).toHaveLength(1);
    expect(selected[0]!.attributes('data-menu-key')).toBe('BasicForm');
    expect(selected[0]!.attributes('aria-current')).toBe('page');
    expect(selected[0]!.find('[data-menu-active-bar]').exists()).toBe(true);
  });

  it('禁用项：button disabled 且点击无反应', async () => {
    const wrapper = mountMenu({ openKeys: ['Demo', 'DemoForm'] });
    const disabled = wrapper
      .findAll('[data-menu-key]')
      .find((row) => row.attributes('data-menu-key') === 'StepForm');
    expect(disabled!.attributes('disabled')).toBe('');
    await disabled!.trigger('click');
    expect(wrapper.emitted('select')).toBeUndefined();
    expect(wrapper.emitted('update:openKeys')).toBeUndefined();
  });

  it('外链渲染成 a 标签，点击交给浏览器，不上抛 select', async () => {
    const wrapper = mountMenu({ openKeys: ['Demo'] });
    const link = wrapper
      .findAll('[data-menu-key]')
      .find((row) => row.attributes('data-menu-key') === 'AntdvDoc');
    expect(link!.element.tagName).toBe('A');
    expect(link!.attributes('href')).toBe('https://antdv-next.com');
    expect(link!.attributes('target')).toBe('_blank');
    expect(link!.attributes('rel')).toBe('noopener noreferrer');
    await link!.trigger('click');
    expect(wrapper.emitted('select')).toBeUndefined();
  });

  it('缩进按层级递增，默认 16px 一级', () => {
    const wrapper = mountMenu({ openKeys: ['Demo', 'DemoForm'] });
    const padding = (key: string) =>
      wrapper
        .findAll('[data-menu-key]')
        .find((row) => row.attributes('data-menu-key') === key)
        ?.attributes('style');
    expect(padding('Demo')).toContain('padding-left: 16px');
    expect(padding('DemoForm')).toContain('padding-left: 32px');
    expect(padding('BasicForm')).toContain('padding-left: 48px');

    const wider = mountMenu({
      inlineIndent: 24,
      openKeys: ['Demo', 'DemoForm'],
    });
    expect(
      wider
        .findAll('[data-menu-key]')
        .find((row) => row.attributes('data-menu-key') === 'BasicForm')
        ?.attributes('style'),
    ).toContain('padding-left: 72px');
  });

  it('keepIconSlot：缺图标的项也占一个图标位，整列文字才不参差', () => {
    const plain = mountMenu();
    const dashboard = plain
      .findAll('[data-menu-key]')
      .find((row) => row.attributes('data-menu-key') === 'Dashboard');
    expect(dashboard!.find('[data-menu-icon]').exists()).toBe(false);

    const slotted = mountMenu({ keepIconSlot: true });
    const same = slotted
      .findAll('[data-menu-key]')
      .find((row) => row.attributes('data-menu-key') === 'Dashboard');
    expect(same!.find('[data-menu-icon]').exists()).toBe(true);
  });

  it('折叠态只剩图标，标题收起', () => {
    const wrapper = mountMenu({ collapsed: true });
    expect(wrapper.find('[data-menu-label]').exists()).toBe(false);
    expect(wrapper.findAll('[data-menu-icon]')).toHaveLength(1);
    expect(wrapper.find('[data-menu-extra]').exists()).toBe(false);
  });
});

describe('basicMenu —— 徽标与附加信息', () => {
  it('dot 徽标渲染成圆点', () => {
    const wrapper = mountMenu();
    const badge = wrapper.find('[data-menu-badge="dot"]');
    expect(badge.exists()).toBe(true);
    expect(wrapper.find('[data-menu-badge="count"]').exists()).toBe(false);
  });

  it('数字徽标超阈值折成 99+', () => {
    const wrapper = mountMenu({
      menus: [
        { badge: { text: 120 }, name: 'A', path: '/a', title: '甲' },
        {
          badge: { overflowCount: 10, text: 42 },
          name: 'B',
          path: '/b',
          title: '乙',
        },
        { badge: { text: 'NEW' }, name: 'C', path: '/c', title: '丙' },
      ],
    });
    const counts = wrapper
      .findAll('[data-menu-badge="count"]')
      .map((node) => node.text());
    expect(counts).toEqual(['99+', '10+', 'NEW']);
  });

  it('extra 只渲染文本，布尔值不当内容画出来', () => {
    const wrapper = mountMenu();
    const extras = wrapper
      .findAll('[data-menu-extra]')
      .map((node) => node.text());
    expect(extras).toEqual(['3']);
  });
});

describe('basicMenu —— 横向形态', () => {
  it('按 bar 排版，点一级目录也上抛 select（停在 404 时点一级菜单要有反应）', async () => {
    const wrapper = mountMenu({ mode: 'horizontal' });
    const list = wrapper.find('[data-menu-variant="bar"]');
    expect(list.exists()).toBe(true);
    const rows = list.findAll(':scope > li > [data-menu-key]');
    expect(rows).toHaveLength(4);

    await rows[0]!.trigger('click');
    expect(wrapper.emitted('select')).toEqual([['Demo']]);
    // 横向栏的目录没有"就地展开"，不该动 openKeys
    expect(wrapper.emitted('update:openKeys')).toBeUndefined();
  });

  it('子项交给浮层，DOM 里默认不存在', () => {
    const wrapper = mountMenu({ mode: 'horizontal' });
    expect(wrapper.find('[data-menu-variant="popup"]').exists()).toBe(false);
    expect(
      document.body.querySelector('[data-menu-variant="popup"]'),
    ).toBeNull();
  });

  it('溢出时渲染左右箭头，文案走注入的 t', async () => {
    // happy-dom/jsdom 都没有布局盒，整块原型给出"内容 800 / 可视 400"的假尺寸，
    // 让溢出判定为真；scrollTo 也不存在，替成 spy 才能断言点击真的滚了。
    const scrollTo = vi.fn();
    const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
    const originals: Record<string, PropertyDescriptor | undefined> = {
      clientWidth: Object.getOwnPropertyDescriptor(proto, 'clientWidth'),
      scrollLeft: Object.getOwnPropertyDescriptor(proto, 'scrollLeft'),
      scrollWidth: Object.getOwnPropertyDescriptor(proto, 'scrollWidth'),
    };
    Object.defineProperty(proto, 'clientWidth', {
      configurable: true,
      get: () => 400,
    });
    Object.defineProperty(proto, 'scrollWidth', {
      configurable: true,
      get: () => 800,
    });
    Object.defineProperty(proto, 'scrollLeft', {
      configurable: true,
      get: () => 100,
      set: () => {},
    });
    (Element.prototype as unknown as { scrollTo: unknown }).scrollTo = scrollTo;

    configureMenu({
      t: (key: string) => `t:${key}`,
    });
    try {
      const wrapper = mountMenu({ mode: 'horizontal' });
      // 溢出是挂载时量出来的，箭头出现后还要等一拍渲染
      await nextTick();
      const left = wrapper.get('[aria-label="t:shell.scrollMenuLeft"]');
      const right = wrapper.get('[aria-label="t:shell.scrollMenuRight"]');
      await left.trigger('click');
      await right.trigger('click');
      expect(scrollTo).toHaveBeenCalledTimes(2);
    } finally {
      for (const [name, descriptor] of Object.entries(originals)) {
        if (descriptor) Object.defineProperty(proto, name, descriptor);
        else Reflect.deleteProperty(proto, name);
      }
    }
  });
});

describe('configureMenu', () => {
  it('默认实现原样返回 key，注入后换成应用的翻译', () => {
    expect(menuRuntime.t('shell.scrollMenuLeft')).toBe('shell.scrollMenuLeft');
    configureMenu({ t: () => '向左滚动' });
    expect(menuRuntime.t('shell.scrollMenuLeft')).toBe('向左滚动');
  });
});
