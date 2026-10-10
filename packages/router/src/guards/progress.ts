import type { Router } from 'vue-router';

import type { ProgressGuardDependencies } from '../meta';

export interface ProgressGuards {
  afterEach: () => void;
  beforeEach: () => void;
  onError: (error: unknown) => void;
}

/**
 * 页面切换进度条的守卫集合（工厂形式，方便单测直接调用而不必造 router）。
 *
 * `start` / `done` 由应用注入（典型实现是 NProgress）：
 * 进度条长什么样是应用的视觉决定，不该由路由包写死一个库。
 *
 * 两个钩子都必须**返回 undefined**：vue-router 5 会把 beforeEach 的返回值
 * 当成导航结果（对象/字符串=重定向目标，false=中止）。
 * `NProgress.start()` 返回的是 NProgress 自身（链式 API），
 * 直接透传出去就会被解析成"重定向到一个非法地址"，
 * 而非法地址又解析回当前路径，于是 beforeEach 无限自触发——
 * 表现是浏览器主线程 100% 卡死、页面永远白屏。
 */
export function createProgressGuards(
  deps: ProgressGuardDependencies,
): ProgressGuards {
  return {
    // 失败/中止的导航也会走 afterEach（vue-router 会带上 failure），
    // 再加 onError 兜底，否则"守卫 reject"时进度条会永远停在半路。
    afterEach: () => {
      deps.done();
    },
    beforeEach: () => {
      deps.start();
    },
    onError: (error: unknown) => {
      deps.onError?.(error);
      deps.done();
    },
  };
}

export function applyProgressGuard(
  router: Router,
  deps: ProgressGuardDependencies,
): ProgressGuards {
  const guards = createProgressGuards(deps);
  router.beforeEach(guards.beforeEach);
  router.afterEach(guards.afterEach);
  router.onError(guards.onError);
  return guards;
}
