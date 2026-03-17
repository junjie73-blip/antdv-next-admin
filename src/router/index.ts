import type { AppRouteRecordRaw } from '#/app-router'
import type { App } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { setupRouterGuards } from './guards'
import { constantRoutes } from './routes'

const router = createRouter({
  history: createWebHashHistory(),
  strict: true,
  scrollBehavior: () => ({
    left: 0,
    top: 0,
  }),
  routes: constantRoutes as AppRouteRecordRaw[],
})

export function setupRouter(app: App) {
  setupRouterGuards(router)
  app.use(router)
}

export default router
