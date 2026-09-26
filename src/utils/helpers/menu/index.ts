import type { MenuProps } from 'antdv-next'
import type { RouteMeta, RouteRecordRaw } from 'vue-router'

import { Icon } from '@iconify/vue'
import { isPlainObject } from 'es-toolkit'
import { h } from 'vue'

import type { BackendMenu, MenuConfig } from '#/menu'

interface MenuItem {
  key: string
  label: string
  icon?: string
  path: string
  children?: MenuItem[]
  hideInMenu?: boolean
  order?: number
}

// ============================================================
// 路由 → 菜单
// ============================================================

function isRouteMeta(meta: unknown): meta is RouteMeta & {
  title?: string
  icon?: string
  hideInMenu?: boolean
  order?: number
} {
  return isPlainObject(meta)
}

function sortMenus(menus: MenuItem[]): MenuItem[] {
  return menus.sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
}

function processRoute(route: RouteRecordRaw): MenuItem | null {
  const meta = route.meta
  if (!isRouteMeta(meta) || meta.hideInMenu) return null

  const name = route.name as string
  return {
    key: name,
    label: meta.title || name,
    icon: meta.icon,
    path: route.path,
    order: meta.order,
  }
}

function buildMenuTree(routes: RouteRecordRaw[]): MenuItem[] {
  const menus: MenuItem[] = []
  for (const route of routes) {
    const item = processRoute(route)
    if (item) {
      if (route.children && route.children.length > 0) {
        item.children = buildMenuTree(route.children)
      }
      menus.push(item)
    }
  }
  return sortMenus(menus)
}

export function generateMenuList(routes: RouteRecordRaw[]): MenuItem[] {
  return buildMenuTree(routes)
}

// ============================================================
// 后端菜单 → antd Menu items
// ============================================================

/** 打开外链（居中弹窗） */
function openExternalWindow(url: string) {
  const width = 1400
  const height = 900
  const left = (window.screen.width - width) / 2
  const top = (window.screen.height - height) / 2
  window.open(url, '_blank', `width=${width},height=${height},left=${left},top=${top},noopener,noreferrer`)
}

/**
 * ⭐ 转换后端菜单为 antd Menu items
 * - 过滤：停用、按钮、隐藏（hidden）
 * - 外链：新窗口打开
 * - 微应用：外部渲染器接管（点击后由路由 meta.microApp 触发加载）
 */
export function transformBackendMenuToItems(menus: BackendMenu[], parentPath = ''): MenuProps['items'] {
  return menus
    .filter((menu) => {
      if (menu.status !== '1') return false
      if (menu.menuType === 3) return false // 按钮不进菜单
      if (menu.hidden) return false // ⭐ 隐藏菜单
      return true
    })
    .map((menu) => {
      const isExternal = !!menu.isExternal
      const hasPath = !!menu.path && menu.path.trim() !== ''

      // 组装完整路径
      let fullPath = ''
      if (hasPath) {
        fullPath = menu.path!.startsWith('/') ? menu.path! : parentPath ? `${parentPath}/${menu.path}` : menu.path!
      }

      const item: Record<string, any> = {
        key: hasPath ? fullPath : menu.menuId || menu.menuName,
        label: menu.menuName,
      }

      // ⭐ 外链：渲染成 <a>，点击新窗口打开
      if (isExternal && hasPath) {
        item.label = h(
          'a',
          {
            href: menu.path,
            target: '_blank',
            rel: 'noopener noreferrer',
            onClick: (e: MouseEvent) => {
              e.preventDefault()
              e.stopPropagation()
              openExternalWindow(menu.path!)
            },
          },
          menu.menuName,
        )
      }

      // 图标
      if (menu.icon) {
        item.icon = () => h(Icon, { icon: menu.icon, class: 'text-lg' })
      }

      // 子菜单
      if (menu.children && menu.children.length > 0) {
        const childParentPath = hasPath ? fullPath : parentPath
        const children = transformBackendMenuToItems(menu.children, childParentPath)
        if (children && children.length > 0) {
          item.children = children
        }
      }

      return item as MenuProps['items'][number]
    })
    .filter(Boolean)
}

// ============================================================
// 本地菜单配置 → antd Menu items（保留原有逻辑）
// ============================================================

export function transformMenuConfigToItems(menus: MenuConfig[], parentPath = ''): MenuProps['items'] {
  return menus
    .filter((menu) => !menu.hidden)
    .map((menu) => {
      const isExternal = !!menu.isExternal
      const hasPath = !!menu.path && menu.path.trim() !== ''

      let fullPath = ''
      if (hasPath) {
        fullPath = isExternal
          ? `external:${menu.path}`
          : menu.path!.startsWith('/')
            ? menu.path!
            : parentPath
              ? `${parentPath}/${menu.path}`
              : menu.path!
      }

      const item: Record<string, any> = hasPath
        ? {
            key: fullPath,
            label: isExternal
              ? h(
                  'a',
                  {
                    href: menu.path,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    onClick: (e: MouseEvent) => {
                      e.preventDefault()
                      e.stopPropagation()
                      openExternalWindow(menu.path!)
                    },
                  },
                  menu.menuName,
                )
              : menu.menuName,
          }
        : {
            key: menu.menuId || menu.menuName || `dir-${Math.random().toString(36).slice(2)}`,
            label: menu.menuName,
          }

      if (menu.icon) {
        item.icon = () => h(Icon, { icon: menu.icon, class: 'text-lg' })
      }

      if (menu.children && menu.children.length > 0) {
        const childParentPath = hasPath
          ? menu.path!.startsWith('/')
            ? menu.path!
            : `${parentPath}/${menu.path}`
          : parentPath
        const children = transformMenuConfigToItems(menu.children, childParentPath)
        if (children && children.length > 0) item.children = children
      }

      return item as MenuProps['items'][number]
    })
    .filter(Boolean)
}

// ============================================================
// 工具函数（保留）
// ============================================================

export function flattenMenus(menus: MenuItem[]): MenuItem[] {
  const result: MenuItem[] = []
  const flatten = (items: MenuItem[]) => {
    for (const item of items) {
      result.push(item)
      if (item.children) flatten(item.children)
    }
  }
  flatten(menus)
  return result
}

export function findMenuByKey(menus: MenuItem[], key: string): MenuItem | undefined {
  for (const menu of menus) {
    if (menu.key === key) return menu
    if (menu.children) {
      const found = findMenuByKey(menu.children, key)
      if (found) return found
    }
  }
  return undefined
}
