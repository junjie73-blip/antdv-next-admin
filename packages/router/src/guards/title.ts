import type { RouteLocationNormalized, Router } from 'vue-router';

import type { TitleGuardDependencies } from '../meta';

import { routeTitle } from '../meta';

/** 默认标题拼接：`页面标题 | 站点名` */
export function formatRouteTitle(title: string, base: string): string {
  return `${title} | ${base}`;
}

/**
 * `afterEach` 处理器工厂。
 *
 * 原实现每次导航都调用一次 `useTitle()`：那是个带 watcher 的组合式函数，
 * 在 afterEach 里反复创建等于每跳一页泄漏一个副作用。
 * 这里直接写 `document.title`（可由 `setTitle` 注入替换），
 * 行为一致且零累积。
 */
export function createTitleAfterEach(
  deps: TitleGuardDependencies,
): (to: RouteLocationNormalized) => void {
  const setTitle =
    deps.setTitle ??
    ((title: string) => {
      if (typeof document !== 'undefined') document.title = title;
    });

  return (to) => {
    const title = routeTitle(to);
    setTitle(
      title
        ? (deps.formatTitle?.(title, deps.baseTitle) ??
            formatRouteTitle(title, deps.baseTitle))
        : deps.baseTitle,
    );

    if (deps.scrollToTop !== false && typeof window !== 'undefined') {
      window.scrollTo({ behavior: 'instant', top: 0 });
    }
  };
}

export function applyTitleGuard(
  router: Router,
  deps: TitleGuardDependencies,
): (to: RouteLocationNormalized) => void {
  const afterEach = createTitleAfterEach(deps);
  router.afterEach((to) => afterEach(to));
  return afterEach;
}
