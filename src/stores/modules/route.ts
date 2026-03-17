import type { AppRouteRecordRaw } from '#/app-router'
import type { BackendMenu, MenuConfig } from '#/menu'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { DefaultLayout } from '@/layouts'
import { frontendMenus } from '@/router/menus'

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
    permissions?: string[]
  }
  component?: unknown
  redirect?: string
  children?: InternalRoute[]
}

function generateRoutesFromMenus(menus: MenuConfig[]): InternalRoute[] {
  return menus.map((menu) => {
    const route: InternalRoute = {
      path: menu.path,
      name: menu.name,
      meta: {
        title: menu.title,
        icon: menu.icon,
        hidden: menu.hidden,
        keepAlive: menu.keepAlive,
        requiresAuth: menu.requiresAuth,
        roles: menu.roles,
        permissions: menu.permissions,
      },
    }

    if (menu.redirect) {
      route.redirect = menu.redirect
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

function generateRoutesFromBackendMenus(backendMenus: BackendMenu[]): InternalRoute[] {
  return backendMenus.map((menu) => {
    const route: InternalRoute = {
      path: menu.path,
      name: menu.name,
      meta: {
        title: menu.title,
        icon: menu.icon,
        hidden: menu.hidden,
        keepAlive: menu.keepAlive,
        requiresAuth: menu.requiresAuth,
        roles: menu.roles,
        permissions: menu.permissions,
      },
    }

    if (menu.redirect) {
      route.redirect = menu.redirect
    }

    if (menu.component) {
      const componentPath = `/src/${menu.component.replace('@/', '')}`
      route.component = modules[componentPath]
    }

    if (menu.children && menu.children.length > 0) {
      route.children = generateRoutesFromBackendMenus(menu.children)
    }

    return route
  })
}

async function fetchBackendMenus(): Promise<BackendMenu[]> {
  await new Promise(resolve => setTimeout(resolve, 300))

  return [
    {
      id: 1,
      parentId: null,
      path: '/dashboard',
      name: 'Dashboard',
      title: '仪表盘',
      icon: 'carbon:dashboard',
      component: '@/views/dashboard/index.vue',
      keepAlive: true,
      sort: 1,
    },
    {
      id: 2,
      parentId: null,
      path: '/system',
      name: 'System',
      title: '系统管理',
      icon: 'carbon:settings',
      sort: 2,
      children: [
        {
          id: 3,
          parentId: 2,
          path: 'user',
          name: 'SystemUser',
          title: '用户管理',
          icon: 'carbon:user',
          component: '@/views/system/user/index.vue',
          keepAlive: true,
          sort: 1,
        },
        {
          id: 4,
          parentId: 2,
          path: 'role',
          name: 'SystemRole',
          title: '角色管理',
          icon: 'carbon:group',
          component: '@/views/system/role/index.vue',
          keepAlive: true,
          sort: 2,
        },
      ],
    },
  ]
}

export const useRouteStore = defineStore('route', () => {
  const menus = ref<MenuConfig[]>([])
  const routes = ref<AppRouteRecordRaw[]>([])
  const isLoaded = ref(false)

  const generateRoutes = (menuList: MenuConfig[]): AppRouteRecordRaw[] => {
    const dynamicRoutes: AppRouteRecordRaw = {
      path: '/',
      name: 'Root',
      component: DefaultLayout,
      redirect: '/dashboard',
      meta: {
        title: '首页',
        icon: 'carbon:home',
      },
      children: generateRoutesFromMenus(menuList) as unknown as AppRouteRecordRaw[],
    }

    return [dynamicRoutes]
  }

  const generateBackendRoutes = (backendMenuList: BackendMenu[]): AppRouteRecordRaw[] => {
    const dynamicRoutes: AppRouteRecordRaw = {
      path: '/',
      name: 'Root',
      component: DefaultLayout,
      redirect: '/dashboard',
      meta: {
        title: '首页',
        icon: 'carbon:home',
      },
      children: generateRoutesFromBackendMenus(backendMenuList) as unknown as AppRouteRecordRaw[],
    }

    return [dynamicRoutes]
  }

  const initFrontendRoutes = () => {
    menus.value = frontendMenus
    routes.value = generateRoutes(frontendMenus)
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
