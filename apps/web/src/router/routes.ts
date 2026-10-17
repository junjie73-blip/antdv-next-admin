import type { AppRouteRecordRaw } from '@antdv/types';

import { useRouteStore } from '@antdv/stores';

/**
 * 静态路由：不参与"菜单即权限"的判断，所以统一标 `requiresAuth: false`，
 * 让动态菜单守卫放行（否则未登录页 / 兜底 404 会被判成无权限）。
 */
export const constantRoutes: AppRouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/login',
    meta: {
      title: '首页',
      hidden: true,
      requiresAuth: false,
    },
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('~/views/login/index.vue'),
    meta: {
      title: '登录',
      hidden: true,
      layout: 'blank',
      requiresAuth: false,
    },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('~/views/register/index.vue'),
    meta: {
      title: '注册',
      hidden: true,
      layout: 'blank',
      requiresAuth: false,
    },
  },
  /**
   * 标签页「刷新当前」的中转路由。
   *
   * 必须显式注册：文件约定式路由会为 `views/redirect/index.vue` 生成的是
   * 精确匹配的 `/redirect`，接不住 `/redirect/system/user` 这种带目的地的写法。
   * 放在 `constantRoutes` 里先于约定路由，优先级更高。
   */
  {
    path: '/redirect/:path(.*)',
    name: 'Redirect',
    component: () => import('~/views/redirect/index.vue'),
    meta: {
      title: '重定向',
      hidden: true,
      requiresAuth: false,
    },
  },
];

/**
 * 通配兜底。**落点不是写死的 404**：
 *
 * 按菜单裁剪注册表之后，越权页面的路由压根没注册，导航只能落到这里 ——
 * 可那是"没权限"，不是"没这个页面"。统一报 404 等于告诉用户"没这个功能"，
 * 他会去打错的地方找，而不是去找管理员开权限。所以这里按全量快照分一次岔：
 * 页面存在而未授权 → 403（与守卫 `forbiddenPath` 同一个落点，两种拦法表现一致）；
 * 真的没这个地址 → 404。
 */
export const catchAllRoute: AppRouteRecordRaw = {
  path: '/:pathMatch(.*)*',
  name: 'CatchAll',
  redirect: (to) =>
    useRouteStore().isUngrantedExistingPage(to.path)
      ? '/error/403'
      : '/error/404',
  meta: {
    title: '页面不存在',
    hidden: true,
    layout: 'blank',
    requiresAuth: false,
  },
};
