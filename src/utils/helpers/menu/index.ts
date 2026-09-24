import type { MenuProps } from "antdv-next";
import type { RouteMeta, RouteRecordRaw } from "vue-router";

import { Icon } from "@iconify/vue";
import { isPlainObject } from "es-toolkit";
import { h } from "vue";

import type { BackendMenu, MenuConfig } from "#/menu";

interface MenuItem {
  key: string;
  label: string;
  icon?: string;
  path: string;
  children?: MenuItem[];
  hideInMenu?: boolean;
  order?: number;
}

interface RouteMetaExt extends RouteMeta {
  title?: string;
  icon?: string;
  hideInMenu?: boolean;
  order?: number;
}

function isRouteMeta(meta: unknown): meta is RouteMetaExt {
  return isPlainObject(meta);
}

function sortMenus(menus: MenuItem[]): MenuItem[] {
  return menus.sort((a, b) => {
    const orderA = a.order ?? 999;
    const orderB = b.order ?? 999;
    return orderA - orderB;
  });
}

function processRoute(route: RouteRecordRaw): MenuItem | null {
  const meta = route.meta;
  if (!isRouteMeta(meta) || meta.hideInMenu) {
    return null;
  }

  const name = route.name as string;
  const path = route.path;

  return {
    key: name,
    label: meta.title || name,
    icon: meta.icon,
    path,
    order: meta.order,
  };
}

function buildMenuTree(routes: RouteRecordRaw[], _parentPath = ""): MenuItem[] {
  const menus: MenuItem[] = [];

  for (const route of routes) {
    if (route.children && route.children.length > 0) {
      const menuItem = processRoute(route);
      if (menuItem) {
        menuItem.children = buildMenuTree(route.children, route.path);
        menus.push(menuItem);
      }
    } else {
      const menuItem = processRoute(route);
      if (menuItem) {
        menus.push(menuItem);
      }
    }
  }

  return sortMenus(menus);
}

export function transformMenuConfigToItems(
  menus: MenuConfig[],
  parentPath = "",
): MenuProps["items"] {
  return menus
    .filter((menu) => !menu.hidden)
    .map((menu) => {
      const isExternal = menu.isExternal;

      // 判断是否有有效路径
      const hasPath = !!menu.path && menu.path.trim() !== "";

      let fullPath = "";
      let item: Record<string, any> = {};

      if (!hasPath) {
        // 目录节点，无路径，使用 menuId 作为 key（若存在），否则使用 menu.name 或随机值
        const key =
          (menu as any).menuId || menu.name || `dir-${Math.random().toString(36).slice(2)}`;
        item = {
          key,
          label: menu.title,
        };
      } else {
        // 普通菜单或外部链接
        fullPath = isExternal
          ? `external:${menu.path}`
          : menu.path.startsWith("/")
            ? menu.path
            : parentPath
              ? `${parentPath}/${menu.path}`
              : menu.path;

        item = {
          key: fullPath,
          label: isExternal
            ? h(
                "a",
                {
                  href: `/#${menu.path}`,
                  target: "_blank",
                  rel: "noopener noreferrer",
                  onClick: (e: MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const width = 1400;
                    const height = 900;
                    const left = (window.screen.width - width) / 2;
                    const top = (window.screen.height - height) / 2;
                    window.open(
                      `/#${menu.path}`,
                      "_blank",
                      `width=${width},height=${height},left=${left},top=${top},noopener,noreferrer`,
                    );
                  },
                },
                menu.name,
              )
            : menu.name,
        };
      }

      // 添加图标
      if (menu.icon) {
        item.icon = () => h(Icon, { icon: menu.icon, class: "text-lg" });
      }

      // 递归处理子菜单
      if (menu.children && menu.children.length > 0) {
        const childParentPath = hasPath
          ? menu.path!.startsWith("/")
            ? menu.path
            : `${parentPath}/${menu.path}`
          : parentPath;
        item.children = transformMenuConfigToItems(menu.children, childParentPath);
      }
      return item as MenuProps["items"][number];
    })
    .filter(Boolean);
}

export function generateMenuList(routes: RouteRecordRaw[]): MenuItem[] {
  return buildMenuTree(routes);
}

export function flattenMenus(menus: MenuItem[]): MenuItem[] {
  const result: MenuItem[] = [];

  function flatten(items: MenuItem[]) {
    for (const item of items) {
      result.push(item);
      if (item.children) {
        flatten(item.children);
      }
    }
  }

  flatten(menus);
  return result;
}

export function findMenuByKey(menus: MenuItem[], key: string): MenuItem | undefined {
  for (const menu of menus) {
    if (menu.key === key) return menu;
    if (menu.children) {
      const found = findMenuByKey(menu.children, key);
      if (found) return found;
    }
  }
  return undefined;
}
export function transformBackendMenuToItems(menus: BackendMenu[]): MenuProps["items"] {
  return menus
    .filter((menu) => menu.status === "1" && menu.menuType !== 3)
    .map((menu) => {
      const item: Record<string, any> = {
        key: menu.menuId,
        label: menu.menuName,
      };

      if (menu.icon) {
        item.icon = () => h(Icon, { icon: menu.icon, class: "text-lg" });
      }

      if (menu.children && menu.children.length > 0) {
        item.children = transformBackendMenuToItems(menu.children);
      }

      return item;
    });
}
