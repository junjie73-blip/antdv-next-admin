import type { App } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

import { createRouter, createWebHashHistory } from 'vue-router';
import { handleHotUpdate, routes } from 'vue-router/auto-routes';

import { setupLayouts } from 'virtual:generated-layouts';

import { setupRouterGuards } from './guards';
import { catchAllRoute, constantRoutes } from './routes';

/**
 * 把"约定路由"拼成应用真正使用的那张表：静态路由 + 套了布局壳的约定路由 + 兜底。
 *
 * 单独成函数不是为了复用两行代码，而是因为**这张表会被拼两次**：
 * 启动时一次，dev 下约定路由 HMR 时再一次（见 `setupRouter` 里的 `handleHotUpdate`）。
 * 两次必须走同一个函数，否则"启动时有布局、热更新后没布局"这种只在开发期出现的
 * 差异就没法靠读代码对齐。
 */
function buildAppRoutes(autoRoutes: RouteRecordRaw[]): RouteRecordRaw[] {
  return [...constantRoutes, ...setupLayouts(autoRoutes), catchAllRoute];
}

/**
 * 应用的路由表全量快照。
 *
 * 单独抽出来不是为了复用，而是为了"在裁剪之前先留一份"：
 * `setupLayouts(routes)` 里的 `routes` 是 HMR 活引用，约定路由一变就重新求值，
 * 已经摘掉的路由会跟着回来；这份数组只在启动时定格一次，导航裁剪以它为准。
 */
const appRoutes = buildAppRoutes(routes);

const router = createRouter({
  history: createWebHashHistory(),
  strict: true,
  scrollBehavior: () => ({
    left: 0,
    top: 0,
  }),
  routes: appRoutes,
});

export function setupRouter(app: App) {
  setupRouterGuards(router, appRoutes);
  app.use(router);
  if (import.meta.hot) {
    /**
     * dev 下改任何一个页面文件都会让 `vue-router/auto-routes` 这个虚拟模块重新求值，
     * 它自带的 HMR 逻辑是「`router.clearRoutes()` → 逐条 `addRoute(新生成的裸路由)`」，
     * 而我们用的 `vite-plugin-vue-layouts-next` 是把布局**编译进路由表**的：
     * `setupLayouts()` 会给每个页面套一层 `{ component: LayoutWrapper, meta.isLayout }`
     * 的父记录。这层父记录**没有 `name`**，裸路由里没有它 ——
     * 于是热更新之后页面被挂到顶层，`src/layouts/index.vue` 这一整套外壳
     * （顶栏、侧栏、标签栏、面包屑）全部消失，表现就是"改一下二级页面，一级布局没了"，
     * 只能整页刷新找回来。
     *
     * `handleHotUpdate` 的第二个参数正是给这件事留的口子：官方声明里写明它
     * "在替换路由之后、导航之前"被调用，拿到的是刚重新生成的那份裸路由。
     * 这里把整张表按启动时同一个 `buildAppRoutes` 重铺一遍 ——
     * 不额外做"只补布局"的增量修补，是因为静态路由（登录、`/redirect/**`、404 兜底）
     * 同样会被那次 `clearRoutes()` 一起清掉，增量补会漏掉它们，
     * 而"漏掉 404 兜底"在 dev 下的表现是乱敲地址直接白屏，比丢布局更难归因。
     *
     * 只影响 dev：`import.meta.hot` 在生产构建里被常量替换，这段整个不进包。
     * 重铺之后由它自己发起的那次 `router.replace(..., force)` 会走到
     * `router/guards` 里的注册表自愈（`syncRoutes`），按菜单做的裁剪仍会重新对齐。
     */
    handleHotUpdate(router, (newRoutes) => {
      const { addRoute, clearRoutes } = router;
      clearRoutes();
      for (const route of buildAppRoutes(newRoutes)) addRoute(route);
    });
  }
  return router;
}
export default router;
