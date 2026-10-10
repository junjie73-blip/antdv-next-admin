import type { MenuProps } from 'antdv-next';

import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import {
  buildMenuItems,
  findAncestorKeys,
  menuKeyOf,
} from '@antdv/shared/menu';
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
 */
export function useSidebarMenu() {
  const route = useRoute();
  const appStore = useAppStore();
  const { regions, source } = useShell();
  const { openMenuByKey } = source;

  /** 当前形态下侧边栏该渲染的那一批菜单 */
  const sourceMenus = regions.sidebarMenus;

  const menuItems = computed<MenuProps['items']>(() =>
    /**
     * `keepIconSlot`：这一列里"有没有图标"不该影响文字起点。
     * 后端菜单偶有缺图标的节点（新增页面还没配图），不补槽位就会出现
     * 一列文字左边缘参差、深层级像是坏了的样子。
     */
    buildMenuItems(sourceMenus.value, { keepIconSlot: true }),
  );

  const selectedKeys = computed(() => {
    const key =
      source.activeLeafKey.value ?? (route.name as string | undefined);
    return key ? [key] : [];
  });

  /** 用户手动展开过之后不再被路由同步覆盖，避免「点开的菜单自己收起」 */
  const userControlled = ref(false);
  const openKeys = ref<string[]>([]);

  function syncOpenKeys() {
    if (userControlled.value) return;
    openKeys.value = findAncestorKeys(sourceMenus.value, selectedKeys.value[0]);
  }

  /**
   * 手风琴：只保留「本次展开项 + 它的祖先链」。
   * 直接截断成最后一个 key 会让三级菜单的父级被收起，看起来像点了没反应。
   */
  const handleOpenChange: MenuProps['onOpenChange'] = (keys) => {
    userControlled.value = true;
    const next = keys as string[];

    if (!appStore.menuAccordion || next.length === 0) {
      openKeys.value = next;
      return;
    }

    const added = next.find((key) => !openKeys.value.includes(key));
    openKeys.value = added
      ? [...findAncestorKeys(sourceMenus.value, added), added]
      : next;
  };

  const handleSelect: MenuProps['onSelect'] = ({ key }) => {
    openMenuByKey(key as string);
  };

  // 切换一级菜单 / 菜单数据变化时重新定位展开链
  watch(
    [() => sourceMenus.value, selectedKeys],
    () => {
      userControlled.value = false;
      syncOpenKeys();
    },
    { immediate: true },
  );

  return {
    menuItems,
    openKeys,
    selectedKeys,
    sourceMenus,
    handleOpenChange,
    handleSelect,
    menuKeyOf,
    syncOpenKeys,
  };
}
