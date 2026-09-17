
import { createRouter, createWebHashHistory } from "vue-router";

import { setupRouterGuards } from "./guards";
import { constantRoutes } from "./routes";

import type { App } from "vue";

import type { AppRouteRecordRaw } from "#/app-router";


const router = createRouter({
  history: createWebHashHistory(),
  strict: true,
  scrollBehavior: () => ({
    left: 0,
    top: 0,
  }),
  routes: constantRoutes as AppRouteRecordRaw[],
});

export function setupRouter(app: App) {
  setupRouterGuards(router);
  app.use(router);
  return router;
}

export default router;
