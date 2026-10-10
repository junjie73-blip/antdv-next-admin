import type { RouteLocationNormalized, Router } from 'vue-router';

import type {
  AuthGuardDependencies,
  DynamicRouteGuardDependencies,
  ProgressGuardDependencies,
  TitleGuardDependencies,
} from '../meta';

import { createAuthGuard } from './auth';
import { createDynamicRouteGuard } from './dynamic-route';
import { applyProgressGuard } from './progress';
import { applyTitleGuard } from './title';

export interface RouterGuardConfig {
  /** 进度条最先注册：后面的守卫可能直接重定向，先起条才有"在加载"的反馈 */
  progress?: ProgressGuardDependencies;
  auth?: AuthGuardDependencies;
  dynamicRoutes?: DynamicRouteGuardDependencies;
  /** 标题走 afterEach，放在最后 */
  title?: TitleGuardDependencies;
  /** 导航日志口子（应用自己决定用 console 还是上报） */
  onNavigate?: (to: RouteLocationNormalized, from: RouteLocationNormalized) => void;
  onError?: (error: Error) => void;
  errorHandler?: (error: Error) => void;
}

/**
 * 按固定顺序装配守卫。
 *
 * 顺序是这套实现的一部分，不是随便排的：
 * progress → auth → dynamicRoutes → title → 日志。
 * auth/dynamic 都可能 `replace`，重定向会重新进入 beforeEach，
 * 因此进度条必须已经在跑；title 只有在导航真正完成时才该改。
 */
export function applyRouterGuards(
  router: Router,
  config: RouterGuardConfig,
): void {
  if (config.progress) {
    applyProgressGuard(router, config.progress);
  }

  if (config.auth) {
    router.beforeEach(createAuthGuard(config.auth));
  }

  if (config.dynamicRoutes) {
    router.beforeEach(createDynamicRouteGuard(config.dynamicRoutes));
  }

  if (config.title) {
    applyTitleGuard(router, config.title);
  }

  if (config.onNavigate) {
    const onNavigate = config.onNavigate;
    router.afterEach((to, from) => onNavigate(to, from));
  }
  /*
   * vue-router 只有 `onError`，并且后一次注册会覆盖前一次 ——
   * 不存在 `onErrorEach`（写错会在装配守卫时直接 TypeError，整站起不来）。
   * `errorHandler` / `onError` 是同一个口子的两个历史名字，去重后按顺序调用，
   * 避免"应用配了 errorHandler 就悄悄丢掉 onError"。
   */
  const errorHandlers = [config.errorHandler, config.onError].filter(
    (handler, index, list): handler is (error: Error) => void =>
      typeof handler === 'function' && list.indexOf(handler) === index,
  );
  if (errorHandlers.length > 0) {
    router.onError((error) => {
      for (const handler of errorHandlers) handler(error);
    });
  }
}

export { createAuthGuard } from './auth';
export { createDynamicRouteGuard, filterRoutes } from './dynamic-route';
export { applyProgressGuard, createProgressGuards } from './progress';
export { isGuestOnly } from './shared';
export {
  applyTitleGuard,
  createTitleAfterEach,
  formatRouteTitle,
} from './title';
