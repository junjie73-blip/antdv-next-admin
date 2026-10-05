import type { Router } from 'vue-router'

import { setupAuthGuard } from './auth'
import { setupDynamicRouteGuard } from './dynamic-route'
import { setupProgressGuard } from './progress'
import { setupTitleGuard } from './title'

export function setupRouterGuards(router: Router) {
  setupProgressGuard(router) // 1. NProgress 埋点
  setupAuthGuard(router) // 2. 登录校验
  setupDynamicRouteGuard(router) // 3. 动态注册（可能触发 replace 重进）
  setupTitleGuard(router) // 5. 标题（afterEach）
  router.afterEach((to, from) => {
    console.log(
      `%c[nav]%c ${from.fullPath} → ${to.fullPath}`,
      'color:#4c9aff',
      'color:inherit',
    )
  })
}
