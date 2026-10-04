import { defineStore } from 'pinia'
import { markRaw, ref } from 'vue'

import type { AppRouteRecordRaw } from '#/app-router'
import type { BackendMenu, MenuConfig, MicroAppConfig } from '#/menu'

import { request } from '~/composables'
import { DefaultLayout } from '~/layouts'

const modules = import.meta.glob('/src/views/**/*.vue')

export interface InternalRoute {
  path: string
  name?: string
  meta?: {
    title: string
    icon?: string
    hidden?: boolean
    keepAlive?: boolean
    requiresAuth?: boolean
    roles?: string[]
    permission?: string[]
    microApp?: MicroAppConfig // ⭐ 透传
    isExternal?: boolean // ⭐
    layout?: 'blank' | 'default' | null // ⭐
  }
  component?: unknown
  redirect?: string
  children?: InternalRoute[]
}

/** 把菜单实体转为路由 meta（统一处理新字段） */
function buildMeta(menu: BackendMenu) {
  return {
    title: menu.menuName,
    icon: menu.icon,
    hidden: !!menu.hidden,
    keepAlive: !!menu.keepAlive,
    requiresAuth: true,
    roles: [],
    permission: menu.permission ? [menu.permission] : [],
    microApp: menu.microApp ?? undefined,
    isExternal: !!menu.isExternal,
    layout: menu.layout ?? undefined,
  }
}

/** 解析组件路径：支持 @/ 与 ~/ 前缀 */
function resolveComponentPath(component: string): string {
  const cleaned = component.replace(/^@\//, '').replace(/^~\//, '')
  return `/src/${cleaned}`
}

/**
 * 生成主布局下的路由
 * - 过滤：外链（isExternal）、blank 布局（单独生成）、按钮（menuType=3）、停用（status!=='1'）
 */
export function generateRoutesFromBackendMenus(backendMenus: BackendMenu[]): InternalRoute[] {
  return backendMenus
    .filter((menu) => {
      if (menu.status !== '1') return false // 停用
      if (menu.menuType === 3) return false // 按钮
      if (menu.isExternal) return false // 外链不挂主布局
      if (menu.layout === 'blank') return false // 全屏路由单独注册
      return true
    })
    .map((menu) => {
      const route: InternalRoute = {
        path: menu.path || '',
        name: menu.menuName,
        meta: buildMeta(menu),
      }

      // 微应用：不加载本地组件
      if (!menu.isExternal && menu.component) {
        const componentPath = resolveComponentPath(menu.component)
        route.component = modules[componentPath]
      }

      if (menu.children && menu.children.length > 0) {
        route.children = generateRoutesFromBackendMenus(menu.children)
      }
      return route
    })
}

/**
 * 生成 blank 布局路由（全屏渲染，不挂主布局）
 * 递归查找所有 layout === 'blank' 的节点
 */
function generateBlankRoutesFromBackendMenus(backendMenus: BackendMenu[]): InternalRoute[] {
  const routes: InternalRoute[] = []

  function walk(list: BackendMenu[]) {
    for (const menu of list) {
      if (menu.status !== '1' || menu.menuType === 3) continue
      if (menu.layout === 'blank' && menu.path) {
        const route: InternalRoute = {
          path: menu.path,
          name: menu.menuName,
          meta: buildMeta(menu),
        }
        if (menu.component && menu.layout !== 'blank') {
          route.component = modules[resolveComponentPath(menu.component)]
        }
        routes.push(route)
      }
      if (menu.children && menu.children.length > 0) {
        walk(menu.children)
      }
    }
  }

  walk(backendMenus)
  return routes
}

async function fetchBackendMenus(): Promise<BackendMenu[]> {
  const response = await request.get<{
    code: number
    data: BackendMenu[]
    message: string
  }>('/auth/menus')
  const data = Array.isArray(response) ? response : response.data
  return data || []
}

export const useRouteStore = defineStore('route', () => {
  const menus = ref<MenuConfig[]>([])
  const routes = ref<AppRouteRecordRaw[]>([])
  const isLoaded = ref(false)

  /**
   * 根据后端菜单列表生成路由树
   */
  const generateBackendRoutes = (backendMenuList: BackendMenu[]): AppRouteRecordRaw[] => {
    const children = generateRoutesFromBackendMenus(backendMenuList) as unknown as AppRouteRecordRaw[]
    const firstPath = children.length > 0 ? children[0]?.path : '/'
    const mainLayoutRoute: AppRouteRecordRaw = {
      path: '/',
      name: 'Root',
      component: markRaw(DefaultLayout),
      redirect: firstPath,
      meta: { title: '首页', icon: 'carbon:home' },
      children,
    }

    // blank 布局路由挂到根（不经过 DefaultLayout）
    const blankRoutes = generateBlankRoutesFromBackendMenus(backendMenuList) as unknown as AppRouteRecordRaw[]
    return [mainLayoutRoute, ...blankRoutes]
  }

  const initBackendRoutes = async () => {
    const backendMenus = await fetchBackendMenus()
    menus.value = backendMenus as unknown as MenuConfig[]
    routes.value = generateBackendRoutes(backendMenus)
    isLoaded.value = true
  }

  const resetRoutes = () => {
    menus.value = []
    routes.value = []
    isLoaded.value = false
  }

  return {
    menus,
    routes,
    isLoaded,
    generateBackendRoutes,
    initBackendRoutes,
    resetRoutes,
  }
})
