import type { Router } from 'vue-router'
import NProgress from 'nprogress'
import { useAppStore } from '@/stores/modules/app'
import { useRouteStore } from '@/stores/modules/route'
import { useUserStore } from '@/stores/modules/user'
import { catchAllRoute } from './routes'

const WHITE_LIST = ['/login', '/register', '/404', '/403', '/503']

NProgress.configure({
  showSpinner: false,
  trickleSpeed: 200,
  minimum: 0.1,
})

function createProgressGuard(router: Router) {
  router.beforeEach(() => {
    NProgress.start()
  })

  router.afterEach(() => {
    NProgress.done()
  })

  router.onError(() => {
    NProgress.done()
  })
}

function createAuthGuard(router: Router) {
  router.beforeEach((to) => {
    const userStore = useUserStore()
    const isLoggedIn = userStore.isLoggedIn
    const requiresAuth = to.meta.requiresAuth !== false
    const isWhiteList = WHITE_LIST.includes(to.path)

    if (isLoggedIn) {
      if (to.path === '/login') {
        return { path: '/dashboard', replace: true }
      }
      return true
    }

    if (isWhiteList || !requiresAuth) {
      return true
    }

    return {
      path: '/login',
      query: { redirect: to.fullPath },
      replace: true,
    }
  })
}

function createPermissionGuard(router: Router) {
  router.beforeEach((to) => {
    const userStore = useUserStore()
    const requiredRoles = to.meta.roles as string[] | undefined
    const requiredPermissions = to.meta.permissions as string[] | undefined

    if (!requiredRoles && !requiredPermissions) {
      return true
    }

    if (requiredRoles) {
      const hasRole = requiredRoles.some(role => userStore.hasRole(role))
      if (!hasRole) {
        return { path: '/403', replace: true }
      }
    }

    if (requiredPermissions) {
      const hasPermission = requiredPermissions.some(perm => userStore.hasPermission(perm))
      if (!hasPermission) {
        return { path: '/403', replace: true }
      }
    }

    return true
  })
}

function createTitleGuard(router: Router) {
  router.afterEach((to) => {
    const title = to.meta.title
    const appTitle = import.meta.env.VITE_APP_TITLE || 'Antdv Next Admin'

    if (title) {
      document.title = `${title} | ${appTitle}`
    }
    else {
      document.title = appTitle
    }
  })
}

function createDynamicRouteGuard(router: Router) {
  router.beforeEach(async (to) => {
    const routeStore = useRouteStore()
    const appStore = useAppStore()
    const userStore = useUserStore()

    if (!userStore.isLoggedIn) {
      return true
    }

    if (routeStore.isLoaded) {
      return true
    }

    const routeMode = appStore.appSetting.routeMode

    if (routeMode === 'frontend') {
      routeStore.initFrontendRoutes()
    }
    else {
      await routeStore.initBackendRoutes()
    }

    routeStore.routes.forEach((route) => {
      router.addRoute(route)
    })

    router.addRoute(catchAllRoute)

    return { ...to, replace: true }
  })
}

export function setupRouterGuards(router: Router) {
  createProgressGuard(router)
  createAuthGuard(router)
  createDynamicRouteGuard(router)
  createPermissionGuard(router)
  createTitleGuard(router)
}
