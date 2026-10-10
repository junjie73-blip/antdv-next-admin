import type { AppRouteRecordRaw } from '@antdv/types';

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

export const catchAllRoute: AppRouteRecordRaw = {
  path: '/:pathMatch(.*)*',
  name: 'CatchAll',
  redirect: '/error/404',
  meta: {
    title: '页面不存在',
    hidden: true,
    layout: 'blank',
    requiresAuth: false,
  },
};
