import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { forceLogout, resetLogoutFlag } from '../src/fetcher';
import { configureRequest, resetRequestRuntime } from '../src/runtime';

// fetcher 只在报错时才用 toast；把 popup-ui 的组件依赖图挡在单测之外
vi.mock('@antdv/popup-ui', () => ({ toast: {} }));

const LOGIN_PATH = '/login';

/**
 * `forceLogout` 是"会话没了"的唯一收尾入口，它有两个必须守住的行为：
 *
 * 1. 清状态。请求层不认识 pinia，怎么清由应用通过 `configureRequest()` 注入的
 *    `onLogout` 决定 —— 这里只断言"退出出口被调用了一次"，
 *    现场清得干不干净由 `stores/__tests__/user-logout.spec.ts` 负责。
 * 2. 回登录页的方式要对：本应用是 hash 路由，登录页是 `/#/login`。
 *    旧实现写的是 `window.location.href = '/login?...'` —— 那是 pathname，
 *    路由表里没有这条真实路径，浏览器会当成跨文档导航整页重载。
 *    jsdom 里给 `location.href` 赋值不会抛（它只是不实现导航），
 *    所以这个 bug 单测抓不到、只在真浏览器里表现为"导航被中途打断"，
 *    这里改成断言"不碰 href、只改 hash"，把意图钉住。
 */

function setHash(hash: string) {
  window.location.hash = hash;
}

const onLogout = vi.fn<() => void>();

function seedRuntime(loginPath = LOGIN_PATH) {
  configureRequest({
    baseUrl: 'http://mock',
    loginPath,
    onLogout,
    tokens: {
      access: () => 'a-token',
      refresh: () => 'r-token',
      setAccess: () => {},
      setRefresh: () => {},
    },
  });
}

beforeEach(() => {
  resetLogoutFlag();
  setHash('');
  onLogout.mockClear();
  seedRuntime();
});

afterEach(() => {
  resetRequestRuntime();
});

describe('forceLogout', () => {
  it('退出时调用应用注入的 onLogout 清状态', () => {
    forceLogout(false);

    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('redirect=false 时只清状态，不动地址', () => {
    setHash('#/system/user');

    forceLogout(false);

    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe('#/system/user');
  });

  it('默认改 hash 回登录页，并把原路径带在 redirect 上', () => {
    setHash('#/system/user');

    forceLogout();

    expect(window.location.hash).toBe(
      `#${LOGIN_PATH}?redirect=${encodeURIComponent('/system/user')}`,
    );
  });

  /**
   * jsdom 不给 `location.href` 赋值会真去导航（它压根没实现跨文档跳转），
   * 所以"是否整页重载"没法直接 spy —— `href` 在 jsdom 里还是 unforgeable 的，
   * `vi.spyOn(window.location, 'href', 'set')` 会抛 Cannot redefine property。
   *
   * 换个角度钉住：只有走 hash 导航，`location.hash` 才会变成登录页；
   * 旧写法赋值 href，hash 会原地不动，下面这条断言立刻红。
   */
  it('回登录页是站内导航：pathname 不动，只有 hash 变了', () => {
    setHash('#/dashboard/analysis');
    const pathname = window.location.pathname;

    forceLogout();

    expect(window.location.pathname).toBe(pathname);
    expect(window.location.hash).toContain(LOGIN_PATH);
  });

  it('已经在登录页就不重复跳（避免 redirect 套 redirect）', () => {
    setHash(`#${LOGIN_PATH}?redirect=${encodeURIComponent('/system/user')}`);
    const before = window.location.hash;

    forceLogout();

    expect(window.location.hash).toBe(before);
  });

  it('5 秒内的重复调用只生效一次（多个并发 401 不该刷屏式重定向）', () => {
    setHash('#/system/user');
    forceLogout();
    expect(window.location.hash).toContain(LOGIN_PATH);

    // 门闩生效的证明：把现场"还原"成还没退出的样子，第二次调用不该再动它
    setHash('#/system/role');
    forceLogout();

    expect(window.location.hash).toBe('#/system/role');
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('resetLogoutFlag 后门闩放开（测试与真实重新登录都靠它）', () => {
    setHash('#/system/user');
    forceLogout();

    resetLogoutFlag();
    setHash('#/system/role');
    forceLogout();

    expect(window.location.hash).toBe(
      `#${LOGIN_PATH}?redirect=${encodeURIComponent('/system/role')}`,
    );
  });

  it('登录页路径来自运行时配置，不是硬编码', () => {
    seedRuntime('/sign-in');
    setHash('#/system/user');

    forceLogout();

    expect(window.location.hash).toBe('#/sign-in?redirect=%2Fsystem%2Fuser');
  });
});
