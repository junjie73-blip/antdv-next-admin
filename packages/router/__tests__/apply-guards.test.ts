import { describe, expect, it, vi } from 'vitest';

import { applyRouterGuards } from '../src/guards';
import { fakeRouter, fakeTo } from './helpers';

const noop = () => {};

describe('applyRouterGuards', () => {
  it('按 progress → auth → dynamic → title → 日志 的顺序装配', () => {
    const { order, router } = fakeRouter();

    applyRouterGuards(router, {
      auth: {
        homePath: '/home',
        isLoggedIn: () => true,
        loginPath: '/login',
        whiteList: [],
      },
      dynamicRoutes: {
        canAccess: () => true,
        homePath: '/home',
        isLoggedIn: () => true,
        isRoutesLoaded: () => true,
        loadRoutes: async () => true,
        loginPath: '/login',
        whiteList: [],
      },
      onNavigate: noop,
      progress: { done: noop, start: noop },
      title: { baseTitle: 'Acme', scrollToTop: false },
    });

    // progress 的三件套先装（beforeEach 起条最早触发），
    // 然后 auth、dynamic 两个 beforeEach，最后 title 与日志两个 afterEach
    expect(order).toEqual([
      'beforeEach',
      'afterEach',
      'onError',
      'beforeEach',
      'beforeEach',
      'afterEach',
      'afterEach',
    ]);
  });

  it('未提供的钩子不注册', () => {
    const { afterEachHandlers, beforeEachHandlers, errorHandlers, router } =
      fakeRouter();

    applyRouterGuards(router, { auth: { homePath: '/home', isLoggedIn: () => false, loginPath: '/login', whiteList: [] } });

    expect(beforeEachHandlers).toHaveLength(1);
    expect(afterEachHandlers).toHaveLength(0);
    expect(errorHandlers).toHaveLength(0);
  });

  it('onNavigate 收到 to / from', () => {
    const seen: Array<[string, string]> = [];
    const { afterEachHandlers, router } = fakeRouter();
    applyRouterGuards(router, {
      onNavigate: (to, from) => seen.push([to.path, from.path]),
    });

    afterEachHandlers[0]!(
      fakeTo({ path: '/to' }),
      fakeTo({ path: '/from' }),
      undefined,
    );

    expect(seen).toEqual([['/to', '/from']]);
  });
  /**
   * REGRESSION：vue-router 的 API 是 `onError`，没有 `onErrorEach`。
   * 早期实现写了 `router.onErrorEach(...)`，类型检查只在包内跑（应用的 vue-tsc 覆盖不到），
   * 而装配守卫发生在应用启动路径上 —— 一旦应用真的传了 onError，整站起不来。
   * 这里同时钉住三件事：用对 API、两个名字都要生效、同一个函数不重复调用。
   */
  it('导航异常走 router.onError，errorHandler 与 onError 都会被调用', () => {
    const { errorHandlers, router } = fakeRouter();
    const seen: string[] = [];

    applyRouterGuards(router, {
      errorHandler: () => seen.push('errorHandler'),
      onError: () => seen.push('onError'),
    });

    expect(errorHandlers).toHaveLength(1);
    errorHandlers[0]!(new Error('boom'));
    expect(seen).toEqual(['errorHandler', 'onError']);
  });

  it('两个名字指向同一个函数时只注册一次调用', () => {
    const { errorHandlers, router } = fakeRouter();
    const spy = vi.fn();

    applyRouterGuards(router, { errorHandler: spy, onError: spy });

    errorHandlers[0]!(new Error('boom'));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
