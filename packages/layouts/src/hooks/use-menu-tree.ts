import type { MenuTreeSource } from '../menu-source';

import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { layoutRuntime } from '@antdv/layout-ui';
import { useApiHealthStore, useRouteStore } from '@antdv/stores';
import { localizeMenus, withoutMenuNames } from '@antdv/utils';

import { createMenuTreeSource } from '../menu-source';

/**
 * 当前语言下的菜单树。
 *
 * 要给用户看菜单标题的地方都从这里取（导航、面包屑、Ctrl+K 搜索面板、标签页），
 * 翻译做在这一处就全都跟着语言走，不必每个组件各翻一遍。
 *
 * 译文查找走 `layoutRuntime.translateMenu`（宿主注入），包内不 import vue-i18n；
 * 返回 `undefined` 表示文案表里没有这一条，`localizeMenus` 会回退成后端原文。
 */
export function useLocalizedMenus() {
  const routeStore = useRouteStore();

  return computed(() =>
    localizeMenus(routeStore.menus, (key) => layoutRuntime.translateMenu(key)),
  );
}

/**
 * 菜单树状态源 —— 选中/展开/图标栏的推导逻辑本体在 `../menu-source`，
 * 这里只把 pinia 的菜单与 vue-router 的当前路由喂进去。
 *
 * 各组件独立调用是安全的：所有状态都由「当前路由 + 菜单树」纯推导，
 * 没有任何本地记录，因此导航栏、图标栏、侧边栏、面包屑、标签页的高亮必然一致。
 */
/**
 * 接口报错期间从导航收起的入口。
 *
 * 只影响这里喂给 `createMenuTreeSource` 的树；route store 的
 * `allowedNames/allowedPaths` 仍由完整菜单树收集，所以直达链接与标签页不会变 403。
 */
const NAV_HIDDEN_ON_API_ERROR = ['DashboardTasks', 'DashboardTickets'] as const;

export function useMenuTree(): MenuTreeSource {
  const route = useRoute();
  const router = useRouter();
  const apiHealth = useApiHealthStore();
  const menus = useLocalizedMenus();
  const navMenus = computed(() =>
    apiHealth.hasError
      ? withoutMenuNames(menus.value, NAV_HIDDEN_ON_API_ERROR)
      : menus.value,
  );

  return createMenuTreeSource({
    menus: () => navMenus.value,
    route: () => ({ name: route.name, path: route.path }),
    router,
  });
}
