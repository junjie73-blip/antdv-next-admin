import type { LayoutNavConfig } from '@antdv/layout-ui';
import type { MenuKey } from '@antdv/types';

import { computed } from 'vue';

import { menuKeyOf } from '@antdv/utils';
import { useAppStore } from '@antdv/stores';

import { useShell } from './use-layout';

/**
 * 顶部横向导航状态。
 *
 * 差异全部来自蓝图的 `headerNavDepth`：
 * - 水平形态（Infinity）：整棵树都在横向栏里，二级用浮层
 *   → selectedKeys 用叶子 key，菜单把祖先 submenu 标成"分支选中"，
 *     因此永远只有一项是 item-selected；
 * - 混合形态（1）：横向栏只放一级（withChildren: false），下级交给图标栏/侧边栏
 *   → selectedKeys 用一级 key。
 *
 * 旧实现把 key 写成 `menu.path`，而后端菜单大多没有 path，
 * 于是一级菜单的 key 全是 undefined —— 点一个、亮一串。现在 key 统一走 `menuKeyOf`。
 *
 * 产出的形状就是 `@antdv/layout-ui` 的 `LayoutNavConfig`（少了 `tone`，
 * 那一层由外壳统一发给各区域）。
 */
export function useHeaderMenu() {
  const appStore = useAppStore();
  const { blueprint, regions, source } = useShell();
  const { activeLeafKey, activeTopKey, openMenuByKey, topMenus } = source;

  /** 单选：受控 selectedKeys，杜绝「多项同时选中」 */
  const selectedKeys = computed<MenuKey[]>(() => {
    const key = regions.navTracksLeaf.value
      ? (activeLeafKey.value ?? activeTopKey.value)
      : activeTopKey.value;
    return key ? [key] : [];
  });

  /**
   * 要滚进可视区的那一项。
   *
   * 水平形态下选中的是叶子，而横向栏上真正画出来的是它的祖先一级菜单，
   * 所以滚动目标必须换成一级 key，否则按 key 找不到节点、既不滚动也不报错。
   */
  const activeKey = computed<MenuKey | undefined>(() => {
    const key = selectedKeys.value[0];
    if (key && topMenus.value.some((menu) => menuKeyOf(menu) === key)) {
      return key;
    }
    return activeTopKey.value;
  });

  const nav = computed<Omit<LayoutNavConfig, 'tone'>>(() => {
    const depth = blueprint.value.headerNavDepth;
    return {
      activeKey: activeKey.value,
      maxDepth: depth,
      menus: topMenus.value,
      scrollable: appStore.headerMenuScroll,
      selectedKeys: selectedKeys.value,
      withChildren: depth > 1,
    };
  });

  return { activeKey, activeTopKey, nav, openMenuByKey, selectedKeys };
}
