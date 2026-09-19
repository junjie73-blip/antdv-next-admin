import { useFullscreen as _useFullscreen, useMediaQuery } from "@vueuse/core";
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";

import type { RouteLocationMatched } from "vue-router";

import type { LayoutMode } from "#/app";
import type { MenuConfig } from "#/menu";

import { useAppStore } from "~/stores";

export type { LayoutMode };

export const COLLAPSED_WIDTH = 80;
const isMobile = useMediaQuery("(max-width: 767px)");
const { isFullscreen: _isFullscreenRef, toggle: _toggleFullscreenFn } = _useFullscreen();
const isFullscreenRef = _isFullscreenRef;
const toggleFullscreenFn = _toggleFullscreenFn;

export function useLayout() {
  const store = useAppStore();

  return {
    collapsed: computed(() => store.sidebarCollapsed),
    isMobile,
    isFullscreen: isFullscreenRef,
    toggleCollapsed: store.toggleSidebar,
    toggleFullscreen: toggleFullscreenFn,
    checkMobile: () => isMobile.value,
    setCollapsed: (value: boolean) =>
      store.updateSetting({
        sidebarCollapsed: value,
      }),
    COLLAPSED_WIDTH,
  };
}

export function useFullscreen() {
  return {
    isFullscreen: isFullscreenRef,
    toggle: toggleFullscreenFn,
  };
}

export function useBreadcrumb() {
  const route = useRoute();
  const breadcrumbs = computed(() => {
    const matched = route.matched.filter(
      (item) => item.meta && typeof item.meta === "object" && "title" in item.meta,
    );
    return matched.map((item: RouteLocationMatched & { meta: Record<string, unknown> }) => ({
      title: (item.meta?.title as string) || "",
      path: item.path,
      icon: item.meta?.icon || "",
    }));
  });
  return { breadcrumbs };
}

function getParentPaths(path: string): string[] {
  const parents: string[] = [];
  const segments = path.split("/").filter(Boolean);
  let current = "";
  for (let i = 0; i < segments.length - 1; i++) {
    current += `/${segments[i]}`;
    parents.push(current);
  }
  return parents;
}

export function useMenu() {
  const route = useRoute();
  const selectedKeys = ref<string[]>([]);
  const openKeys = ref<string[]>([]);

  // 由外部注入的菜单树（用于反查 key / 祖先）
  const menuTree = ref<any[]>([]);
  const parentMap = ref<Record<string, string>>({});

  function setMenuTree(tree: any[]) {
    menuTree.value = tree || [];
    // 同时构建 child → parent 映射
    const map: Record<string, string> = {};
    const walk = (list: any[], parentKey?: string) => {
      for (const item of list) {
        if (!item?.key) continue;
        if (parentKey) map[item.key] = parentKey;
        if (Array.isArray(item.children)) walk(item.children, item.key);
      }
    };
    walk(menuTree.value);
    parentMap.value = map;
  }

  /** 根据当前路由路径反查菜单 key */
  function findMenuKeyByPath(path: string, list: any[] = menuTree.value): string | null {
    for (const item of list) {
      if (!item?.key) continue;
      // 外链 key 形如 external:/xxx，跳过
      const key = String(item.key);
      if (!key.startsWith("external:")) {
        // 完全匹配
        if (key === path) return key;
        // 兼容子路由：如 /user/detail/1 命中 /user
        if (path.startsWith(key + "/")) return key;
      }
      if (Array.isArray(item.children)) {
        const found = findMenuKeyByPath(path, item.children);
        if (found) return found;
      }
    }
    return null;
  }

  /** 同步选中态与展开态 */
  function syncMenuByRoute(path?: string) {
    const currentPath = path || route.path;
    const matchedKey = findMenuKeyByPath(currentPath);
    if (!matchedKey) {
      selectedKeys.value = [];
      return;
    }
    selectedKeys.value = [matchedKey];

    // 构建祖先链作为 openKeys
    const ancestors: string[] = [];
    let cursor: string | undefined = matchedKey;
    while (cursor && parentMap.value[cursor]) {
      cursor = parentMap.value[cursor];
      ancestors.unshift(cursor!);
    }
    openKeys.value = ancestors;
  }

  /** 手风琴 openChange：保留最新 key 及其祖先 */
  function handleOpenChange(keys: string[]) {
    const latestOpenKey = keys.find((key) => !openKeys.value.includes(key));
    if (!latestOpenKey) {
      openKeys.value = keys;
      return;
    }
    const ancestors: string[] = [];
    let cursor: string | undefined = latestOpenKey;
    while (cursor && parentMap.value[cursor]) {
      cursor = parentMap.value[cursor];
      ancestors.unshift(cursor!);
    }
    openKeys.value = keys.filter((k) => k === latestOpenKey || ancestors.includes(k));
  }

  // 路由变化时自动同步
  watch(
    () => route.path,
    () => syncMenuByRoute(),
    { immediate: true },
  );

  return {
    selectedKeys,
    openKeys,
    handleOpenChange,
    setMenuTree,
    syncMenuByRoute,
  };
}
