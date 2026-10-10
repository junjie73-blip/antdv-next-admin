import { describe, expect, it, vi } from 'vitest';

import { applyProgressGuard, createProgressGuards } from '../src/guards/progress';
import { createTitleAfterEach, formatRouteTitle } from '../src/guards/title';
import { fakeRouter } from './helpers';

describe('createProgressGuards', () => {
  it('start / done 分别挂在导航开始与结束', () => {
    const start = vi.fn();
    const done = vi.fn();
    const guards = createProgressGuards({ done, start });

    guards.beforeEach();
    expect(start).toHaveBeenCalledTimes(1);
    expect(done).not.toHaveBeenCalled();

    guards.afterEach();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('钩子必须返回 undefined：链式库的返回值会被 vue-router 5 当成导航结果', () => {
    // 复刻 NProgress 这类链式 API：start() 返回库自身。
    // 一旦透传出去，vue-router 5 会把该对象解析成"重定向目标"，
    // 目标又落回当前路径，于是 beforeEach 无限自触发，浏览器主线程直接卡死。
    const progress = {
      done() {
        return this;
      },
      start() {
        return this;
      },
    };
    const guards = createProgressGuards({
      done: () => progress.done(),
      start: () => progress.start(),
    });

    expect(guards.beforeEach()).toBeUndefined();
    expect(guards.afterEach()).toBeUndefined();

    // 装配到 router 上同样不能把值漏给导航链路
    const { beforeEachHandlers, router } = fakeRouter();
    applyProgressGuard(router, {
      done: () => progress.done(),
      start: () => progress.start(),
    });
    expect(beforeEachHandlers[0]?.({} as never, {} as never, () => {})).toBeUndefined();
  });

  it('导航出错也要收尾，否则进度条永远停在半路', () => {
    const done = vi.fn();
    const onError = vi.fn();
    const guards = createProgressGuards({ done, onError, start: () => {} });
    const error = new Error('chunk load failed');

    guards.onError(error);

    expect(onError).toHaveBeenCalledWith(error);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('applyProgressGuard 把三个钩子装到 router 上', () => {
    const { afterEachHandlers, beforeEachHandlers, errorHandlers, router } =
      fakeRouter();
    applyProgressGuard(router, { done: () => {}, start: () => {} });

    expect(beforeEachHandlers).toHaveLength(1);
    expect(afterEachHandlers).toHaveLength(1);
    expect(errorHandlers).toHaveLength(1);
  });
});

describe('createTitleAfterEach', () => {
  it('有 meta.title 时拼接站点名', () => {
    const setTitle = vi.fn();
    const afterEach = createTitleAfterEach({ baseTitle: 'Acme', scrollToTop: false, setTitle });

    afterEach({ meta: { title: '用户管理' }, path: '/system/user' } as never);
    expect(setTitle).toHaveBeenCalledWith('用户管理 | Acme');
  });

  it('没有标题时用站点名，空字符串标题也算没有', () => {
    const setTitle = vi.fn();
    const afterEach = createTitleAfterEach({ baseTitle: 'Acme', scrollToTop: false, setTitle });

    afterEach({ meta: {}, path: '/a' } as never);
    afterEach({ meta: { title: '' }, path: '/b' } as never);

    expect(setTitle.mock.calls.map((call) => call[0])).toEqual(['Acme', 'Acme']);
  });

  it('formatTitle 可定制', () => {
    const setTitle = vi.fn();
    const afterEach = createTitleAfterEach({
      baseTitle: 'Acme',
      formatTitle: (title, base) => `${base} - ${title}`,
      scrollToTop: false,
      setTitle,
    });

    afterEach({ meta: { title: '报表' }, path: '/report' } as never);
    expect(setTitle).toHaveBeenCalledWith('Acme - 报表');
  });

  it('默认写 document.title 并滚到顶部', () => {
    const scrollTo = vi.fn();
    const originalScrollTo = window.scrollTo;
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: scrollTo });
    document.title = '初始';

    try {
      createTitleAfterEach({ baseTitle: 'Acme' })({
        meta: { title: '首页' },
        path: '/',
      } as never);
      expect(document.title).toBe('首页 | Acme');
      expect(scrollTo).toHaveBeenCalledWith({ behavior: 'instant', top: 0 });
    } finally {
      Object.defineProperty(window, 'scrollTo', {
        configurable: true,
        value: originalScrollTo,
      });
      document.title = '';
    }
  });

  it('formatRouteTitle 就是默认的拼接方式', () => {
    expect(formatRouteTitle('列表', 'Acme')).toBe('列表 | Acme');
  });
});
