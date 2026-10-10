import type { NavigationGuard, RouteRecordRaw } from 'vue-router';

import type { DynamicRouteGuardDependencies } from '../meta';

import { requiresAuth } from '../meta';
import { isGuestOnly } from './shared';

/**
 * 按允许的 path 集合过滤路由表。
 *
 * 纯函数：父路由本身不在集合里、但子孙在 → 保留父路由（只留命中的孩子），
 * 否则嵌套布局会整块消失。返回的是浅拷贝，不改原路由表。
 */
export function filterRoutes(
  routes: RouteRecordRaw[],
  allowed: readonly string[] | Set<string>,
): RouteRecordRaw[] {
  const allowedPaths = allowed instanceof Set ? allowed : new Set(allowed);
  const result: RouteRecordRaw[] = [];

  for (const route of routes) {
    const selfMatched = allowedPaths.has(route.path);
    const childMatched =
      route.children?.some((child) => allowedPaths.has(child.path)) ?? false;
    if (!selfMatched && !childMatched) continue;

    const cloned: RouteRecordRaw = { ...route };
    if (route.children?.length) {
      cloned.children = filterRoutes(route.children, allowedPaths);
    }
    result.push(cloned);
  }

  return result;
}

/**
 * 动态菜单守卫工厂：登录后首次导航时拉取并注册路由，再按 name 鉴权。
 *
 * 三条关键防线（都是原实现踩过的坑）：
 * 1. `loadRoutes` 抛错必须吞掉并放行——否则 beforeEach 反复 reject，
 *    表现是"接口挂了以后哪里都点不动"的死循环；
 * 2. 无 `name` 的路由（布局父级）与 `meta.requiresAuth === false` 的静态页
 *    （登录/注册/404 兜底）不参与鉴权；父级只参与下面的"目录落地"重定向；
 * 3. 访客页判断与登录守卫共用同一份逻辑，避免两处规则漂移。
 *
 * 鉴权交给 `canAccess({ name, path })`：文件约定式路由的 name 由框架生成，
 * 和业务菜单的 name 往往不同源，只按 name 判会把合法页面误判成无权限，
 * 所以应用侧允许"name 或 path 任一命中菜单"。
 */
export function createDynamicRouteGuard(
  deps: DynamicRouteGuardDependencies,
): NavigationGuard {
  return async (to) => {
    const loggedIn = deps.isLoggedIn();
    const isPublic = deps.whiteList.includes(to.path);

    if (!loggedIn) {
      if (!requiresAuth(to) || isPublic) return true;
      return {
        path: deps.loginPath,
        query: { redirect: to.fullPath },
        replace: true,
      };
    }

    if (isGuestOnly(to.path, deps)) {
      return { path: deps.homePath, replace: true };
    }

    if (!deps.isRoutesLoaded()) {
      try {
        await deps.loadRoutes();
      } catch (error) {
        deps.onError?.(error);
        // 菜单拉失败先放行：路由表缺项最多是 404，卡住不动才是事故
        return true;
      }
    }

    // 白名单页 / 显式 requiresAuth: false 的静态页不参与菜单鉴权
    if (isPublic || !requiresAuth(to)) return true;

    // 有 name 才判权限；无 name 的是布局父级（目录记录），它压根没有页面组件可鉴
    if (to.name && !deps.canAccess({ name: String(to.name), path: to.path })) {
      return { path: deps.forbiddenPath ?? '/403', replace: true };
    }

    /**
     * 目录节点落地：`/dashboard`、`/system` 这类菜单目录自己没有页面组件，
     * 停在上面就是"整块内容区空白"（登录成功默认跳 `/dashboard` 正好踩中）。
     *
     * 位置很关键：必须在"无 name 直接放行"之前。文件约定路由给目录生成的记录
     * 恰恰是**没有 name** 的那批，写在鉴权后面就永远轮不到它们。
     * 返回同一个 path 时不再重定向，避免自跳自的死循环。
     */
    const landing = deps.resolveDirectory?.(to.path);
    if (landing && landing !== to.path) {
      return { path: landing, replace: true };
    }

    return true;
  };
}
