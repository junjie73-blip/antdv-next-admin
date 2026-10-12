import type { FixtureRoute } from '../types';

import { describe, expect, it } from 'vitest';

import { fixtures } from '../fixtures';

/**
 * 钉住生成产物的契约：入库的快照要能被覆盖层直接消费，
 * 也不需要构建时有 Nitro 服务在跑（CI 与离线构建都要能出包）。
 */

function pathsOf(routes: FixtureRoute[]): Set<string> {
  return new Set(routes.map((route) => `${route.method} ${route.path}`));
}

describe('生成的 fixtures', () => {
  it('首屏依赖的接口都在表里', () => {
    const paths = pathsOf(fixtures.routes);
    expect(
      [
        'GET /auth/user-info',
        'GET /menus',
        'POST /auth/login',
        'POST /auth/logout',
      ].filter((key) => !paths.has(key)),
    ).toEqual([]);
  });

  it('读接口有快照、写接口一律没有（抓写接口会改坏开发中的 mock 数据）', () => {
    const readsWithoutSnapshot = fixtures.routes
      .filter((route) => route.method === 'GET' && !route.response)
      .map((route) => route.path);
    const writesWithSnapshot = fixtures.routes
      .filter((route) => route.method !== 'GET' && route.response)
      .map((route) => route.path);
    expect([...readsWithoutSnapshot, ...writesWithSnapshot]).toEqual([]);
  });

  it('每条快照都是 code/data/message 三字段信封', () => {
    const broken = fixtures.routes
      .filter((route) => route.response)
      .filter(
        (route) =>
          Object.keys(route.response as object).join(',') !==
          'code,data,message',
      )
      .map((route) => route.path);
    expect(broken).toEqual([]);
  });

  it('列表接口登记的集合在 data 里真有对应数组', () => {
    const lists = fixtures.routes.filter(
      (
        route,
      ): route is FixtureRoute & { collection: string; listField: string } =>
        !!route.listField && !!route.collection,
    );
    const broken = lists
      .filter((route) => {
        const data = (route.response as { data: Record<string, unknown> }).data;
        return !Array.isArray(data[route.listField]);
      })
      .map((route) => route.path);
    expect(broken).toEqual([]);
  });

  it('/mock-center 与上传接口不进 fixtures，留给真实 fetch 透传', () => {
    const leaked = fixtures.routes
      .filter(
        (route) =>
          route.path.includes('mock-center') ||
          route.path.startsWith('/upload'),
      )
      .map((route) => route.path);
    expect(leaked).toEqual([]);
  });

  it('登录三条接口的路径与账号都对得上 mock 服务', () => {
    const paths = new Set(fixtures.routes.map((route) => route.path));
    const success = fixtures.auth.success as {
      data: { user: { token: string; username: string } };
    };
    // 抓取时的 token 带着那一刻的时间戳，生成器把它归一成固定串，重跑才没有无意义 diff
    expect([...paths]).toEqual(
      expect.arrayContaining([
        fixtures.auth.loginPath,
        fixtures.auth.logoutPath,
        fixtures.auth.userPath,
      ]),
    );
    expect(success.data.user.token).toBe('mock_token_0');
    expect(success.data.user.username).toBe(
      fixtures.auth.accounts[0]?.username,
    );
  });

  /**
   * 生产预览里的双权限演示全靠这两条：账号表 + 菜单接口路径。
   * 少一份数据不会报错，只会静默变成"所有账号都是超管"，所以必须钉住。
   */
  it('账号表带齐凭据与菜单白名单，menusPath 指向真存在的接口', () => {
    const paths = new Set(fixtures.routes.map((route) => route.path));
    expect(paths.has(fixtures.menusPath)).toBe(true);

    expect(fixtures.auth.accounts.length).toBeGreaterThan(1);
    for (const account of fixtures.auth.accounts) {
      expect(account.profile.username).toBe(account.username);
      expect(account.profile.token).toBeUndefined();
      expect(account.roles.length).toBeGreaterThan(0);
      expect(account.permissions.length).toBeGreaterThan(0);
    }

    const wildcards = fixtures.auth.accounts.filter(
      (account) => account.visibleMenus === null,
    );
    expect(wildcards.length).toBe(1);
    expect(wildcards[0]?.permissions).toContain('*');
    // 至少一个账号是逐条列举的，否则"权限生成对不对"在生产里没有观测点
    expect(fixtures.auth.accounts.some((a) => a.visibleMenus !== null)).toBe(
      true,
    );
  });
});
