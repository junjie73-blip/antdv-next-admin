import type { RouteRecordRaw, Router } from 'vue-router'

import { HOME_PATH, LOGIN_PATH, WHITE_LIST } from '~/config/constants'
import { useRouteStore } from '~/stores'
import { useUserStore } from '~/stores/modules/user'

export function filterRoutes(
  routes: RouteRecordRaw[],
  allowed: Set<string>,
): RouteRecordRaw[] {
  const result: RouteRecordRaw[] = []
  for (const route of routes) {
    const selfMatched = allowed.has(route.path)
    const childMatched =
      route.children?.some((c) => allowed.has(c.path)) ?? false
    if (!selfMatched && !childMatched) continue

    const cloned: RouteRecordRaw = { ...route }
    if (route.children?.length) {
      cloned.children = filterRoutes(route.children, allowed)
    }
    result.push(cloned)
  }
  return result
}

export function setupDynamicRouteGuard(router: Router) {
  router.beforeEach(async (to) => {
    const userStore = useUserStore()
    const routeStore = useRouteStore()
    const requiresAuth = to.meta.requiresAuth !== false
    const isWhitelisted = (WHITE_LIST as readonly string[]).includes(to.path)

    // 1. 未登录
    if (!userStore.isLoggedIn) {
      if (!requiresAuth || isWhitelisted) return true
      return {
        path: LOGIN_PATH,
        query: { redirect: to.fullPath },
        replace: true,
      }
    }

    // 2. 已登录访问登录/注册 → 回家
    if (to.path === LOGIN_PATH || to.path === '/register') {
      return { path: HOME_PATH, replace: true }
    }

    // 3. 菜单未加载 → 加载一次
    if (!routeStore.isLoaded) {
      try {
        await routeStore.initRoutes()
      } catch (e) {
        console.error('[guard] initRoutes failed', e)
        return true // 菜单拉失败，先放行，避免死循环
      }
    }

    // 4. 白名单 / 无 name → 放行
    if (isWhitelisted || !to.name) return true

    // 5. 权限：用 route name 匹配后端菜单 name
    if (!routeStore.canAccess(to.name as string)) {
      return { path: '/403', replace: true }
    }

    return true
  })
}
