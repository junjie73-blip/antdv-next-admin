import type { Router } from 'vue-router';

import { HOME_PATH, LOGIN_PATH, WHITE_LIST } from '~/config/constants';
import { useUserStore } from '~/stores/modules/user';

export function setupAuthGuard(router: Router) {
  router.beforeEach((to) => {
    const userStore = useUserStore();
    const requiresAuth = to.meta.requiresAuth !== false;
    const isWhitelisted = (WHITE_LIST as readonly string[]).includes(to.path);

    // 已登录访问登录/注册 → 回家
    if (
      userStore.isLoggedIn &&
      (to.path === LOGIN_PATH || to.path === '/register')
    ) {
      return { path: HOME_PATH, replace: true };
    }

    // 公开页面直接放行
    if (!requiresAuth || isWhitelisted) return true;

    // 需要登录但未登录 → 跳登录
    if (!userStore.isLoggedIn) {
      return {
        path: LOGIN_PATH,
        query: { redirect: to.fullPath },
        replace: true,
      };
    }

    return true;
  });
}
