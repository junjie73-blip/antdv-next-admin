import type { RouteMeta, RouteRecordRaw } from 'vue-router'
import { isPlainObject } from 'es-toolkit'

interface MenuItem {
  key: string
  label: string
  icon?: string
  path: string
  children?: MenuItem[]
  hideInMenu?: boolean
  order?: number
}

interface RouteMetaExt extends RouteMeta {
  title?: string
  icon?: string
  hideInMenu?: boolean
  order?: number
}

function isRouteMeta(meta: unknown): meta is RouteMetaExt {
  return isPlainObject(meta)
}

function sortMenus(menus: MenuItem[]): MenuItem[] {
  return menus.sort((a, b) => {
    const orderA = a.order ?? 999
    const orderB = b.order ?? 999
    return orderA - orderB
  })
}

function processRoute(route: RouteRecordRaw): MenuItem | null {
  const meta = route.meta
  if (!isRouteMeta(meta) || meta.hideInMenu) {
    return null
  }

  const name = route.name as string
  const path = route.path

  return {
    key: name,
    label: meta.title || name,
    icon: meta.icon,
    path,
    order: meta.order,
  }
}

function buildMenuTree(routes: RouteRecordRaw[], parentPath = ''): MenuItem[] {
  const menus: MenuItem[] = []

  for (const route of routes) {
    if (route.children && route.children.length > 0) {
      const menuItem = processRoute(route)
      if (menuItem) {
        menuItem.children = buildMenuTree(route.children, route.path)
        menus.push(menuItem)
      }
    }
    else {
      const menuItem = processRoute(route)
      if (menuItem) {
        menus.push(menuItem)
      }
    }
  }

  return sortMenus(menus)
}

export function generateMenuList(routes: RouteRecordRaw[]): MenuItem[] {
  return buildMenuTree(routes)
}

export function flattenMenus(menus: MenuItem[]): MenuItem[] {
  const result: MenuItem[] = []

  function flatten(items: MenuItem[]) {
    for (const item of items) {
      result.push(item)
      if (item.children) {
        flatten(item.children)
      }
    }
  }

  flatten(menus)
  return result
}

export function findMenuByKey(menus: MenuItem[], key: string): MenuItem | undefined {
  for (const menu of menus) {
    if (menu.key === key)
      return menu
    if (menu.children) {
      const found = findMenuByKey(menu.children, key)
      if (found)
        return found
    }
  }
  return undefined
}
