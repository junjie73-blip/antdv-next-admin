import type { MenuConfig } from '@antdv/types';

import { mount } from '@vue/test-utils';

import { buildMenuItems } from '@antdv/shared/menu';
import { Menu } from 'antdv-next';

/**
 * 图标槽位真的能落到 DOM 上。
 *
 * `buildMenuItems(..., { keepIconSlot: true })` 给没图标的项返回一个空 `<span>`，
 * 但"占位"成立的前提是 antd 会把 `.ant-menu-item-icon` 这个类（以及它的 `min-width`）
 * 加到渲染结果上 —— 这条前提属于 antd 的实现，不是我们的代码，光看
 * `packages/shared` 的单测（只断言"我传了个 icon 渲染器"）根本盖不住。
 *
 * 所以这里把 `Menu` 真挂起来数 DOM：
 * 同层每一项都得有一个带 `.ant-menu-item-icon` 的图标位，缺图标的也不能例外。
 * 少一个，那一列的文字左边缘就比邻居靠左，看起来就是"菜单样式参差"。
 */
describe('侧栏图标槽位（keepIconSlot）', () => {
  const menus: MenuConfig[] = [
    {
      name: 'Group',
      path: '',
      title: '分组',
      icon: 'lucide:folder',
      children: [
        // 有图标
        { name: 'A', path: '/a', title: '甲', icon: 'lucide:user' },
        // 没图标 —— 就是要它占位
        { name: 'B', path: '/b', title: '乙' },
      ],
    },
  ];

  function mountSidebar(items: MenuConfig[], keepIconSlot: boolean) {
    const wrapper = mount(Menu, {
      props: {
        items: buildMenuItems(items, { keepIconSlot }),
        mode: 'inline',
        /**
         * 子菜单默认是收起的，收起时子项压根不在 DOM 里（inline 模式没有浮层兜底），
         * 数不到 `.ant-menu-item` 就成了空跑。这里显式把「分组」展开。
         */
        openKeys: ['Group'],
      },
    });
    if (wrapper.findAll('.ant-menu-item').length === 0) {
      throw new Error(`菜单没渲染出条目，DOM 是：\n${wrapper.html()}`);
    }
    return wrapper.findAll('.ant-menu-item').map((item) => ({
      iconSlots: item.findAll('.ant-menu-item-icon').length,
      text: item.text(),
    }));
  }

  it('开了开关：没有图标的项也占一个图标位', () => {
    const rows = mountSidebar(menus, true);
    expect(rows.map((row) => row.text)).toEqual(['甲', '乙']);
    for (const row of rows) {
      expect(
        row.iconSlots,
        `「${row.text}」没有渲染出 .ant-menu-item-icon 图标位`,
      ).toBe(1);
    }
  });

  /**
   * 反向：不开就没有空槽。
   * 顶栏横向导航按内容宽度排布，白留一格会挤掉一个菜单项（溢出时更明显）。
   */
  it('不开开关：没图标的项不留空位', () => {
    const rows = mountSidebar(menus, false);
    expect(rows.find((row) => row.text === '乙')!.iconSlots).toBe(0);
    expect(rows.find((row) => row.text === '甲')!.iconSlots).toBe(1);
  });
});
