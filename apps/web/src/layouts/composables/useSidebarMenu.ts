import type { MenuKey } from '@antdv/types';

import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { findAncestorKeys } from '@antdv/utils';
import { useAppStore } from '~/stores/modules/app';

import { useShell } from './useLayout';

/**
 * 侧边栏菜单状态。
 *
 * 数据源不再由组件自己判断 `layout === 'mixed'`，而是问蓝图：
 * - vertical / side-nav：整棵菜单树
 * - two-column / mixed-vertical：当前一级菜单的子树
 * - mixed-two-column：当前图标栏选中项的子树（三级及以下）
 *
 * 选中态与展开态都由路由纯推导（key 走 `menuKeyOf`），因此导航栏、图标栏、
 * 侧边栏、标签页、面包屑五者的高亮永远一致，不依赖任何本地记录。
 *
 * 迁移前这里还要把菜单编译成 antd 的 `items`（图标/badge/外链都是渲染函数的参数）。
 * 换成 `@antdv/menu-ui` 后渲染事实由包内的 `toMenuNodes` 归一，
 * 应用侧只交数据树 + 受控状态，`keepIconSlot` 这类视觉参数交给 `@antdv/layout-ui`。
 */
export function useSidebarMenu() {
  const route = useRoute();
  const appStore = useAppStore();
  const { regions, source } = useShell();
  const { openMenuByKey } = source;

  /** 当前形态下侧边栏该渲染的那一批菜单 */
  const menus = regions.sidebarMenus;

  const selectedKeys = computed<MenuKey[]>(() => {
    const key =
      source.activeLeafKey.value ?? (route.name as string | undefined);
    return key ? [key] : [];
  });

  /** 用户手动展开过之后不再被路由同步覆盖，避免「点开的菜单自己收起」 */
  const userControlled = ref(false);
  const openKeys = ref<MenuKey[]>([]);

  function syncOpenKeys() {
    if (userControlled.value) return;
    openKeys.value = findAncestorKeys(menus.value, selectedKeys.value[0]);
  }

  /**
   * 手风琴：只保留「本次展开项 + 它的祖先链」。
   * 直接截断成最后一个 key 会让三级菜单的父级被收起，看起来像点了没反应。
   *
   * `BasicMenu` 只上报"下一份展开集"，怎么取舍是产品语义，留在应用侧。
   */
  function setOpenKeys(keys: MenuKey[]) {
    userControlled.value = true;

    if (!appStore.menuAccordion || keys.length === 0) {
      openKeys.value = keys;
      return;
    }

    const added = keys.find((key) => !openKeys.value.includes(key));
    openKeys.value = added
      ? [...findAncestorKeys(menus.value, added), added]
      : keys;
  }

  // 切换一级菜单 / 菜单数据变化时重新定位展开链
  watch(
    [() => menus.value, selectedKeys],
    () => {
      userControlled.value = false;
      syncOpenKeys();
    },
    { immediate: true },
  );

  return {
    menus,
    openKeys,
    setOpenKeys,
    selectedKeys,
    openMenuByKey,
    syncOpenKeys,
  };
}
