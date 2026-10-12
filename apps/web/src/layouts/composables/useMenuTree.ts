import type { MenuTreeSource } from '@antdv/layouts';

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { createMenuTreeSource } from '@antdv/layouts';
import { localizeMenus } from '~/locales/menu';
import { useRouteStore } from '~/stores/modules/route';

/**
 * 当前语言下的菜单树。
 *
 * 要给用户看菜单标题的地方都从这里取（导航、面包屑、Ctrl+K 搜索面板），
 * 翻译做在这一处就全都跟着语言走，不必每个组件各翻一遍。
 */
export function useLocalizedMenus() {
  const routeStore = useRouteStore();
  const { t, te } = useI18n({ useScope: 'global' });

  return computed(() =>
    localizeMenus(routeStore.menus, (key) => (te(key) ? t(key) : undefined)),
  );
}

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
  const menus = useLocalizedMenus();

  return createMenuTreeSource({
    menus: () => menus.value,
    route: () => ({ name: route.name, path: route.path }),
    router,
  });
}
