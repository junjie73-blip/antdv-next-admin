import type { AppRouteRecordRaw } from '#/app-router'
import type { BackendMenu, MenuConfig } from '#/menu'
import { defineStore } from 'pinia'
import { markRaw, ref } from 'vue'
import { DefaultLayout } from '@/layouts'
import { http } from '@/utils/request'

const modules = import.meta.glob('/src/views/**/*.vue')

interface InternalRoute {
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
    microApp?: MicroAppConfig
  }
  component?: unknown
  redirect?: string
  children?: InternalRoute[]
}

interface MicroAppConfig {
  name: string
  url: string
  baseroute: string
  keepAlive?: boolean
}

function generateRoutesFromMenus(menus: MenuConfig[]): InternalRoute[] {
  return menus
    .filter((menu) => !menu.isExternal && menu.layout !== 'blank')
    .map((menu) => {
      const route: InternalRoute = {
        path: menu.path,
        name: menu.name,
        meta: {
          icon: menu.icon,
          title: menu.name,
          permission: menu.permission!,
        },
      }

      if (menu.component) {
        const componentPath = `/src/${menu.component.replace('@/', '')}`
        route.component = modules[componentPath]
      }

      if (menu.children && menu.children.length > 0) {
        route.children = generateRoutesFromMenus(menu.children)
      }

      return route
    })
}

function generateBlankRoutesFromMenus(menus: MenuConfig[]): InternalRoute[] {
  const routes: InternalRoute[] = []

  function walk(list: MenuConfig[]) {
    for (const menu of list) {
      if (menu.layout === 'blank' && menu.component) {
        const route: InternalRoute = {
          path: menu.path,
          name: menu.name,
          meta: {
            title: menu.name,
            icon: menu.icon,
            permission: menu.permission!,
            microApp: menu.microApp,
          },
        }

        if (menu.component) {
          const componentPath = `/src/${menu.component.replace('@/', '')}`
          route.component = modules[componentPath]
        }

        routes.push(route)
      }

      if (menu.children && menu.children.length > 0) {
        walk(menu.children)
      }
    }
  }

  walk(menus)
  return routes
}

function generateRoutesFromBackendMenus(backendMenus: BackendMenu[]): InternalRoute[] {
  return backendMenus
    .filter((menu) => menu.status === '1' && menu.menuType !== 3) // 只处理启用的目录和菜单，忽略按钮
    .map((menu) => {
      const route: InternalRoute = {
        path: menu.path || '',
        name: menu.menuName, // 或使用 menuId 作为 name
        meta: {
          title: menu.menuName,
          icon: menu.icon,
          hidden: false, // 可以根据需要设置
          keepAlive: false,
          requiresAuth: true,
          roles: [], // 可扩展
          permission: menu.permission ? [menu.permission] : [],
        },
      }

      if (menu.component) {
        const componentPath = `/src/${menu.component.replace(/^@\//, '')}`
        route.component = modules[componentPath]
      }

      if (menu.children && menu.children.length > 0) {
        route.children = generateRoutesFromBackendMenus(menu.children)
      }

      return route
    })
}

async function fetchBackendMenus(): Promise<BackendMenu[]> {
  const response = await http.Get<{ code: number; data: BackendMenu[]; message: string }>(
    '/auth/menus',
  )
  // 兼容不同的返回包裹，例如直接返回数组
  const data = Array.isArray(response) ? response : response.data
  return data || []
}

export const useRouteStore = defineStore('route', () => {
  const menus = ref<MenuConfig[]>([])
  const routes = ref<AppRouteRecordRaw[]>([])
  const isLoaded = ref(false)

  const generateRoutes = (menuList: MenuConfig[]): AppRouteRecordRaw[] => {
    const children = generateRoutesFromBackendMenus(
      menuList as unknown as BackendMenu[],
    ) as unknown as AppRouteRecordRaw[]
    const firstPath = children.length > 0 ? children[0]?.path : '/'
    const dynamicRoutes: AppRouteRecordRaw = {
      path: '/',
      name: 'Root',
      component: markRaw(DefaultLayout),
      redirect: firstPath,
      meta: {
        title: '首页',
        icon: 'carbon:home',
      },
      children,
    }

    const blankRoutes = generateBlankRoutesFromMenus(menuList) as unknown as AppRouteRecordRaw[]

    return [dynamicRoutes, ...blankRoutes]
  }

  const generateBackendRoutes = (backendMenuList: BackendMenu[]): AppRouteRecordRaw[] => {
    const children = generateRoutesFromBackendMenus(
      backendMenuList,
    ) as unknown as AppRouteRecordRaw[]
    const firstPath = children.length > 0 ? children[0]?.path : '/'
    const dynamicRoutes: AppRouteRecordRaw = {
      path: '/',
      name: 'Root',
      component: markRaw(DefaultLayout),
      redirect: firstPath,
      meta: {
        title: '首页',
        icon: 'carbon:home',
      },
      children,
    }
    return [dynamicRoutes]
  }

  const initFrontendRoutes = () => {
    isLoaded.value = true
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
    generateRoutes,
    generateBackendRoutes,
    initFrontendRoutes,
    initBackendRoutes,
    resetRoutes,
  }
})
