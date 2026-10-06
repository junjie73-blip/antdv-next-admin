
import type { MenuConfig, MenuKey } from '@antdv/types';

import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useRouteStore } from '~/stores/modules/route';
import {
  attachMenuPaths,
  findMenuChain,
  firstLeafMenu,
  flattenLeafMenus,
  isLeafMenu,
  menuKeyOf,
  visibleMenus,
} from '~/utils/helpers/menu';

/**
 * `Array.prototype.at` 需要 lib=es2022，仓库的 app 配置是 es2020，
 * 这里用索引取值等价实现，保持类型与运行时都安全。
 */
function last<T>(list: T[]): T | undefined {
  return list.length > 0 ? list[list.length - 1] : undefined;
}

/**
 * 菜单树状态源：三种布局（垂直 / 水平 / 混合）都从这里取数据，
 * 保证「同一条路由 → 同一个 key → 同一个标题」在导航栏、侧边栏、标签页一致。
 */
export function useMenuTree() {
  const router = useRouter();
  const route = useRoute();
  const routeStore = useRouteStore();

  /** 后端菜单只给 name，path 由路由表反查补全 */
  const menus = computed(() => attachMenuPaths(routeStore.menus, router));
  const topMenus = computed(() => visibleMenus(menus.value));
  const leafMenus = computed(() => flattenLeafMenus(menus.value));

  /** 当前路由命中的菜单节点：先按 name，再按完整 path 回退 */
  const currentMenu = computed<MenuConfig | undefined>(() => {
    const list = menus.value;
    const byName = findMenuChain(
      list,
      (m) => !!route.name && m.name === route.name,
    );
    if (byName.length > 0) return last(byName);
    const byPath = findMenuChain(
      list,
      (m) => !!m.path && m.path === route.path,
    );
    return last(byPath);
  });

  /** 当前路由的祖先链（含自身），一级菜单 = 链首 */
  const currentChain = computed<MenuConfig[]>(() => {
    const menu = currentMenu.value;
    if (!menu) return [];
    const key = menuKeyOf(menu);
    return findMenuChain(menus.value, (m) => menuKeyOf(m) === key);
  });

  const activeTopMenu = computed<MenuConfig | undefined>(
    () => currentChain.value[0] ?? topMenus.value[0],
  );

  /** 一级导航的选中 key：路由不在菜单里时回退第一项，避免横向菜单全灰 */
  const activeTopKey = computed<MenuKey | undefined>(() =>
    activeTopMenu.value ? menuKeyOf(activeTopMenu.value) : undefined,
  );

  /** 叶子 key：水平布局用它做精准单选 */
  const activeLeafKey = computed<MenuKey | undefined>(() =>
    currentMenu.value ? menuKeyOf(currentMenu.value) : undefined,
  );

  /** 当前一级菜单是否有子节点：决定混合布局要不要显示侧边栏 */
  const activeTopChildren = computed<MenuConfig[]>(() =>
    visibleMenus(activeTopMenu.value?.children),
  );
  const hasSubMenus = computed(() => activeTopChildren.value.length > 0);

  /**
   * 侧边栏数据源。
   * - 混合布局：只渲染当前一级菜单的子树（二级菜单）
   * - 垂直布局：渲染整棵树
   */
  function sidebarMenus(mixed: boolean) {
    return computed<MenuConfig[]>(() =>
      mixed ? activeTopChildren.value : menus.value,
    );
  }

  function openExternal(path: string) {
    window.open(path, '_blank', 'noopener,noreferrer');
  }

  /**
   * 打开菜单节点。
   * 目录 → 跳它的第一个可见叶子；外链 → 新窗口；叶子 → 按 name 跳路由
   * （name 缺失时用 path 兜底），重复导航的失败直接吞掉。
   */
  function openMenu(menu?: MenuConfig): Promise<void> {
    if (!menu) return Promise.resolve();

    if (menu.isExternal && menu.path) {
      openExternal(menu.path);
      return Promise.resolve();
    }

    if (!isLeafMenu(menu)) return openMenu(firstLeafMenu(menu));

    const { name, path } = menu;
    const target = name && router.hasRoute(name) ? { name } : path;
    if (!target) {
      console.warn('[menu] 无法定位路由:', menu.title, menu);
      return Promise.resolve();
    }
    return router.push(target as never).then(
      () => {},
      () => {},
    );
  }

  /** 横向导航点击：key 可能是一级目录，也可能是叶子 */
  function openMenuByKey(key?: MenuKey) {
    if (!key) return;
    const menu = last(findMenuChain(menus.value, (m) => menuKeyOf(m) === key));
    return openMenu(menu);
  }

  return {
    menus,
    topMenus,
    leafMenus,
    currentMenu,
    currentChain,
    activeTopMenu,
    activeTopKey,
    activeLeafKey,
    activeTopChildren,
    hasSubMenus,
    sidebarMenus,
    openMenu,
    openMenuByKey,
  };
}
