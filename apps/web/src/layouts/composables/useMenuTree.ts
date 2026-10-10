import type { MenuTreeSource } from '@antdv/layouts';

import { useRoute, useRouter } from 'vue-router';

import { createMenuTreeSource } from '@antdv/layouts';
import { useRouteStore } from '~/stores/modules/route';

/**
 * 应用侧的菜单树状态源 —— 逻辑本体在 `@antdv/layouts` 里，这里只做依赖注入。
 *
 * 包不 import pinia / vue-router，菜单与路由都以 getter 传进去；
 * 于是同一份"选中态推导"在单测里喂一个数组就能验证，在应用里吃 store。
 *
 * 各组件独立调用是安全的：所有状态都由「当前路由 + 菜单树」纯推导，
 * 没有任何本地记录，因此导航栏、图标栏、侧边栏、面包屑、标签页的高亮必然一致。
 */
export function useMenuTree(): MenuTreeSource {
  const route = useRoute();
  const router = useRouter();
  const routeStore = useRouteStore();

  return createMenuTreeSource({
    menus: () => routeStore.menus,
    route: () => ({ name: route.name, path: route.path }),
    router,
  });
}
