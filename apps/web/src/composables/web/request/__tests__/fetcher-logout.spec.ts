import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { LOGIN_PATH } from '~/config/constants';
import { useRouteStore } from '~/stores/modules/route';
import { useTabsStore } from '~/stores/modules/tabs';
import { useUserStore } from '~/stores/modules/user';

import { forceLogout, resetLogoutFlag } from '../fetcher';

/**
 * `forceLogout` 是"会话没了"的唯一收尾入口，它有两个必须守住的行为：
 *
 * 1. 状态清干净（凭证 / 页面缓存 / 菜单授权 / 标签页）；
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

function seededStores() {
  const user = useUserStore();
  const route = useRouteStore();
  const tabs = useTabsStore();

  user.token = 'a-token';
  user.userInfo = { id: 1, username: 'admin' } as never;
  route.isLoaded = true;
  route.allowedPaths = new Set(['/system/user']);
  tabs.tabs = [
    { closable: true, key: '/system/user', path: '/system/user', title: '用户管理' },
  ] as never;

  return { route, tabs, user };
}

beforeEach(() => {
  setActivePinia(createPinia());
  resetLogoutFlag();
  setHash('');
});

describe('forceLogout', () => {
  it('把上一个账号的会话态全部清掉', () => {
    const { route, tabs, user } = seededStores();

    forceLogout(false);

    expect(user.isLoggedIn).toBe(false);
    expect(route.isLoaded).toBe(false);
    expect([...route.allowedPaths]).toEqual([]);
    expect(tabs.tabs).toEqual([]);
  });

  it('redirect=false 时只清状态，不动地址', () => {
    setHash('#/system/user');
    expect(window.location.hash).toBe('#/system/user');
    const { user } = seededStores();

    forceLogout(false);

    expect(user.isLoggedIn).toBe(false);
    expect(window.location.hash).toBe('#/system/user');
  });

  it('默认改 hash 回登录页，并把原路径带在 redirect 上', () => {
    setHash('#/system/user');
    seededStores();

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
    seededStores();

    forceLogout();

    expect(window.location.pathname).toBe(pathname);
    expect(window.location.hash).toContain(LOGIN_PATH);
  });

  it('已经在登录页就不重复跳（避免 redirect 套 redirect）', () => {
    setHash(`#${LOGIN_PATH}?redirect=${encodeURIComponent('/system/user')}`);
    const before = window.location.hash;
    seededStores();

    forceLogout();

    expect(window.location.hash).toBe(before);
  });

  it('5 秒内的重复调用只生效一次（多个并发 401 不该刷屏式重定向）', () => {
    setHash('#/system/user');
    const { user } = seededStores();
    forceLogout();
    expect(window.location.hash).toContain(LOGIN_PATH);

    // 门闩生效的证明：把现场"还原"成还没退出的样子，第二次调用不该再动它
    setHash('#/system/role');
    user.token = 'another-token';

    forceLogout();

    expect(window.location.hash).toBe('#/system/role');
    expect(user.isLoggedIn).toBe(true);
  });

  it('resetLogoutFlag 后门闩放开（测试与真实重新登录都靠它）', () => {
    setHash('#/system/user');
    seededStores();
    forceLogout();

    resetLogoutFlag();
    setHash('#/system/role');
    forceLogout();

    expect(window.location.hash).toBe(
      `#${LOGIN_PATH}?redirect=${encodeURIComponent('/system/role')}`,
    );
  });
});
