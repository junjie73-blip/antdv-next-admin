import type { MenuProps } from 'antdv-next';

import { computed } from 'vue';

import { buildMenuItems, menuKeyOf } from '@antdv/shared/menu';

import { useShell } from './useLayout';

/**
 * 顶部横向导航状态。
 *
 * 差异全部来自蓝图的 `headerNavDepth`：
 * - 水平形态（Infinity）：整棵树都在横向栏里，二级用浮层
 *   → selectedKeys 用叶子 key，antd 会把祖先 submenu 标成 submenu-selected，
 *     因此永远只有一项是 item-selected；
 * - 混合形态（1）：横向栏只放一级（withChildren: false），下级交给图标栏/侧边栏
 *   → selectedKeys 用一级 key。
 *
 * 旧实现把 key 写成 `menu.path`，而后端菜单大多没有 path，
 * 于是一级菜单的 key 全是 undefined —— 点一个、亮一串。现在 key 统一走 `menuKeyOf`。
 */
export function useHeaderMenu() {
  const { blueprint, regions, source } = useShell();
  const { activeLeafKey, activeTopKey, openMenuByKey, topMenus } = source;

  const menuItems = computed<MenuProps['items']>(() => {
    const depth = blueprint.value.headerNavDepth;
    return buildMenuItems(topMenus.value, {
      maxDepth: depth,
      withChildren: depth > 1,
    });
  });

  /** 单选：受控 selectedKeys，杜绝「多项同时选中」 */
  const selectedKeys = computed<string[]>(() => {
    const key = regions.navTracksLeaf.value
      ? (activeLeafKey.value ?? activeTopKey.value)
      : activeTopKey.value;
    return key ? [key] : [];
  });

  /** 当前选中项在横向栏里的位置，用于自动滚入可视区 */
  const activeIndex = computed(() => {
    const key = selectedKeys.value[0];
    if (!key) return -1;
    const index = menuItems.value?.findIndex((item) => item?.key === key) ?? -1;
    if (index >= 0) return index;
    // 水平形态下选中的是叶子，横向栏上高亮的是它的祖先一级菜单
    const topKey = activeTopKey.value;
    return topKey
      ? (menuItems.value?.findIndex((item) => item?.key === topKey) ?? -1)
      : -1;
  });

  function handleSelect(info: { key: string }) {
    openMenuByKey(info.key);
  }

  return {
    activeIndex,
    activeTopKey,
    handleSelect,
    menuItems,
    menuKeyOf,
    selectedKeys,
  };
}
