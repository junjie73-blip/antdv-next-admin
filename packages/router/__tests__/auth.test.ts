import { describe, expect, it } from 'vitest';

import { createAuthGuard } from '../src/guards/auth';
import { fakeTo, runGuard } from './helpers';

const deps = {
  homePath: '/dashboard/analysis',
  loginPath: '/login',
  whiteList: ['/login', '/register', '/error/404'],
};

function guard(isLoggedIn: boolean) {
  return createAuthGuard({ ...deps, isLoggedIn: () => isLoggedIn });
}

describe('createAuthGuard', () => {
  it('未登录访问受保护页：跳登录并带上 redirect', () => {
    expect(runGuard(guard(false), fakeTo({ path: '/system/user' }))).toEqual({
      path: '/login',
      query: { redirect: '/system/user' },
      replace: true,
    });
  });

  it('白名单与 requiresAuth: false 都放行', () => {
    expect(runGuard(guard(false), fakeTo({ path: '/error/404' }))).toBe(true);
    expect(
      runGuard(
        guard(false),
        fakeTo({ meta: { requiresAuth: false }, path: '/public-page' }),
      ),
    ).toBe(true);
  });

  it('已登录访问登录页/注册页：回家', () => {
    expect(runGuard(guard(true), fakeTo({ path: '/login' }))).toEqual({
      path: deps.homePath,
      replace: true,
    });
    expect(runGuard(guard(true), fakeTo({ path: '/register' }))).toEqual({
      path: deps.homePath,
      replace: true,
    });
  });

  it('已登录访问业务页放行', () => {
    expect(runGuard(guard(true), fakeTo({ path: '/system/user' }))).toBe(true);
  });

  it('guestOnlyPaths 可扩展，登录页始终算访客页', () => {
    const withInvite = createAuthGuard({
      ...deps,
      guestOnlyPaths: ['/invite'],
      isLoggedIn: () => true,
    });
    expect(runGuard(withInvite, fakeTo({ path: '/invite' }))).toEqual({
      path: deps.homePath,
      replace: true,
    });
    expect(runGuard(withInvite, fakeTo({ path: '/login' }))).toEqual({
      path: deps.homePath,
      replace: true,
    });
    // 未列出的页面不受影响
    expect(runGuard(withInvite, fakeTo({ path: '/system/user' }))).toBe(true);
  });

  it('登录态是每次导航现取的，不是创建时快照', () => {
    let loggedIn = false;
    const dynamic = createAuthGuard({ ...deps, isLoggedIn: () => loggedIn });

    expect(runGuard(dynamic, fakeTo({ path: '/system/user' }))).not.toBe(true);

    loggedIn = true;
    expect(runGuard(dynamic, fakeTo({ path: '/system/user' }))).toBe(true);
  });
});
