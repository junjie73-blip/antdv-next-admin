import type { MenuConfig } from '@antdv/types';

import type { MenuNode, ToMenuNodesOptions } from './types';

import { menuKeyOf, visibleMenus } from '@antdv/shared/menu';

/**
 * 把业务菜单树归一成渲染节点。
 *
 * 这里只做「数据 → 渲染事实」，不碰展开/选中状态：状态由 `BasicMenu` 的受控
 * props 提供，折叠与手风琴策略留在应用侧（迁移前也是这样——`openKeys` 一直由
 * `useSidebarMenu` 计算，菜单组件只负责画）。
 */
export function toMenuNodes(
  menus: MenuConfig[],
  options: ToMenuNodesOptions = {},
): MenuNode[] {
  const { maxDepth = Infinity, withChildren = true } = options;

  const walk = (list: MenuConfig[], depth: number): MenuNode[] =>
    visibleMenus(list).map((menu) => {
      /**
       * 外链的判定与迁移前 `buildMenuItems` 保持一致：`isExternal` 且带 path 就渲染成
       * `<a>`，不再要求 path 必须是绝对 URL —— 后端偶尔给相对路径也标外链，
       * 渲染层擅自改语义就会出现"点外链变成了站内跳转"。
       */
      const external =
        menu.isExternal && menu.path ? menu.path : undefined;
      // 深度截断后不再下探：被截断的目录 `children` 为空，`leaf` 为真，
      // 于是横向导航的一级项点击即导航，与迁移前 antd `@click` 的表现一致。
      const children =
        withChildren && depth < maxDepth
          ? walk(menu.children ?? [], depth + 1)
          : [];

      return {
        badge: menu.badge,
        children,
        depth,
        disabled: Boolean(menu.disabled),
        external,
        extra: menu.extra,
        icon: menu.icon,
        key: menuKeyOf(menu),
        leaf: children.length === 0,
        path: menu.path,
        title: menu.title,
      };
    });

  return walk(menus, 1);
}

/** 树里是否存在该 key（浮层里的父级被选中时，横向栏要把祖先标成选中态） */
export function containsKey(nodes: MenuNode[], key?: string): boolean {
  if (!key) return false;
  return nodes.some(
    (node) => node.key === key || containsKey(node.children, key),
  );
}

/**
 * 某个父级子树里是否命中选中项。
 *
 * antd 的行为是：叶子被选中时，它所在的 submenu 标题进入 `submenu-selected`，
 * 横向栏因此知道「当前页面属于哪一项」。这里等价实现，且只认渲染出来的子树，
 * 被 `maxDepth` 截断的层级不会误报。
 */
export function isBranchSelected(node: MenuNode, selected?: string): boolean {
  if (!selected) return false;
  if (node.key === selected) return true;
  return node.children.some((child) => isBranchSelected(child, selected));
}
