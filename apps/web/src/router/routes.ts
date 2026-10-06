import type { AppRouteRecordRaw } from '@antdv/types';
export const constantRoutes: AppRouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/login',
    meta: {
      title: '首页',
      hidden: true,
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
  },
};
