import type { BackendMenu, MenuConfig } from '@antdv/types';

import { ref } from 'vue';

// stores/modules/route.ts
import { defineStore } from 'pinia';
import { http } from '~/composables';

export const useRouteStore = defineStore('route', () => {
  const backendMenus = ref<BackendMenu[]>([]);
  const menus = ref<MenuConfig[]>([]);
  /** 允许访问的路由 name 集合（用于权限判断） */
  const allowedNames = ref(new Set<string>());
  const isLoaded = ref(false);
  const loading = ref(false);

  /** 后端菜单 → 前端菜单，仅做字段映射 */
  function normalize(list: BackendMenu[]): MenuConfig[] {
    return list
      .filter((m) => m && typeof m === 'object' && !m.hidden)
      .map((m) => {
        if (m.name) allowedNames.value.add(m.name);

        return {
          name: m.name,
          title: m.menuName ?? m.name ?? '',
          icon: m.icon,
          hidden: m.hidden,
          isExternal: m.isExternal,
          path: m.path, // 外链用
          keepAlive: m.keepAlive,
          children: m.children?.length ? normalize(m.children) : undefined,
        } as MenuConfig;
      });
  }

  async function fetchBackendMenus(): Promise<BackendMenu[]> {
    const res = await http.Get<{ code: number; data: { list: BackendMenu[] } }>(
      '/menus',
    );
    return res.data.list;
  }

  async function initRoutes() {
    if (loading.value) return;
    loading.value = true;
    try {
      const list = await fetchBackendMenus();
      backendMenus.value = list;
      allowedNames.value = new Set();
      menus.value = normalize(list);
      isLoaded.value = true;
    } finally {
      loading.value = false;
    }
  }

  /** 是否可访问某个路由 name */
  function canAccess(name?: string) {
    if (!name) return true;
    return allowedNames.value.has(name);
  }

  function resetRoutes() {
    backendMenus.value = [];
    menus.value = [];
    allowedNames.value = new Set();
    isLoaded.value = false;
  }

  return {
    backendMenus,
    menus,
    allowedNames,
    isLoaded,
    loading,
    initRoutes,
    canAccess,
    resetRoutes,
  };
});
