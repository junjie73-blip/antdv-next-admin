import type { NavigationGuard } from 'vue-router';

import type { AuthGuardDependencies } from '../meta';

import { isOneOf, requiresAuth } from '../meta';
import { isGuestOnly } from './shared';

/**
 * 登录校验守卫工厂。
 *
 * 状态通过 `isLoggedIn()` 注入：包不 import user store，
 * 于是同一套判定能服务任意"登录态来源"（pinia / firebase / oidc）。
 */
export function createAuthGuard(deps: AuthGuardDependencies): NavigationGuard {
  return (to) => {
    const loggedIn = deps.isLoggedIn();

    // 已登录访问登录/注册 → 回家
    if (loggedIn && isGuestOnly(to.path, deps)) {
      return { path: deps.homePath, replace: true };
    }

    // 显式公开页 / 白名单直接放行
    if (!requiresAuth(to) || isOneOf(deps.whiteList, to.path)) return true;

    // 需要登录但未登录 → 带 redirect 去登录页
    if (!loggedIn) {
      return {
        path: deps.loginPath,
        query: { redirect: to.fullPath },
        replace: true,
      };
    }

    return true;
  };
}
