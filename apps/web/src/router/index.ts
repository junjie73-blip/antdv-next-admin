import type { App } from 'vue';

import { createRouter, createWebHashHistory } from 'vue-router';
import { handleHotUpdate, routes } from 'vue-router/auto-routes';

import { setupLayouts } from 'virtual:generated-layouts';

import { setupRouterGuards } from './guards';
import { catchAllRoute, constantRoutes } from './routes';

const router = createRouter({
  history: createWebHashHistory(),
  strict: true,
  scrollBehavior: () => ({
    left: 0,
    top: 0,
  }),
  routes: [...constantRoutes, ...setupLayouts(routes), catchAllRoute],
});

export function setupRouter(app: App) {
  setupRouterGuards(router);
  app.use(router);
  if (import.meta.hot) {
    handleHotUpdate(router);
  }
  return router;
}
export default router;
