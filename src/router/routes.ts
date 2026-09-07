import type { AppRouteRecordRaw } from '#/app-router'

export const constantRoutes: AppRouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/login',
    meta: {
      title: '根路径',
      hidden: true,
    },
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: {
      title: '登录',
      hidden: true,
      layout: 'blank',
    },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/register/index.vue'),
    meta: {
      title: '注册',
      hidden: true,
      layout: 'blank',
    },
  },
  {
    path: '/404',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: {
      title: '页面不存在',
      hidden: true,
      layout: 'blank',
    },
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/views/error/403.vue'),
    meta: {
      title: '无权限',
      hidden: true,
      layout: 'blank',
    },
  },
  {
    path: '/503',
    name: 'ServiceUnavailable',
    component: () => import('@/views/error/503.vue'),
    meta: {
      title: '服务不可用',
      hidden: true,
      layout: 'blank',
    },
  },
]

export const catchAllRoute: AppRouteRecordRaw = {
  path: '/:pathMatch(.*)*',
  name: 'CatchAll',
  redirect: '/404',
  meta: {
    title: 'CatchAll',
    hidden: true,
  },
}
