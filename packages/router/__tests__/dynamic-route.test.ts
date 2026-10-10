import type { RouteRecordRaw } from 'vue-router';

import { describe, expect, it, vi } from 'vitest';

import {
  createDynamicRouteGuard,
  filterRoutes,
} from '../src/guards/dynamic-route';
import { fakeTo, runGuard } from './helpers';

const baseDeps = {
  forbiddenPath: '/403',
  homePath: '/dashboard/analysis',
  loginPath: '/login',
  whiteList: ['/login', '/register', '/error/404', '/error/403'],
};

function makeDeps(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    ...baseDeps,
    canAccess: vi.fn(() => true),
    isRoutesLoaded: vi.fn(() => true),
    isLoggedIn: vi.fn(() => true),
    loadRoutes: vi.fn(async () => true),
    ...overrides,
  } as unknown as Parameters<typeof createDynamicRouteGuard>[0] & {
    canAccess: ReturnType<typeof vi.fn>;
    isRoutesLoaded: ReturnType<typeof vi.fn>;
    loadRoutes: ReturnType<typeof vi.fn>;
  };
}

describe('filterRoutes', () => {
  const routes = [
    {
      children: [{ path: '/system/user' }, { path: '/system/role' }],
      path: '/system',
    },
    { path: '/about' },
  ] as unknown as RouteRecordRaw[];

  it('只保留命中的子路由，父路由因孩子命中而保留', () => {
    const result = filterRoutes(routes, new Set(['/system/user']));
    expect(result).toHaveLength(1);
    expect(result[0]?.path).toBe('/system');
    expect(result[0]?.children?.map((route) => route.path)).toEqual([
      '/system/user',
    ]);
  });

  it('接受数组形式的允许集合', () => {
    expect(filterRoutes(routes, ['/about'])).toEqual([{ path: '/about' }]);
  });

  it('父路由本身命中但孩子都不命中时，孩子被清空', () => {
    const result = filterRoutes(routes, new Set(['/system']));
    expect(result[0]?.children).toEqual([]);
  });

  it('不改写传入的路由表', () => {
    const snapshot = JSON.stringify(routes);
    filterRoutes(routes, new Set(['/system']));
    expect(JSON.stringify(routes)).toBe(snapshot);
  });
});

describe('createDynamicRouteGuard', () => {
  it('未登录访问受保护页：跳登录，且不去拉菜单', async () => {
    const deps = makeDeps({ isLoggedIn: () => false });
    const result = await runGuard(createDynamicRouteGuard(deps), fakeTo({ path: '/system/user' }));

    expect(result).toEqual({
      path: '/login',
      query: { redirect: '/system/user' },
      replace: true,
    });
    expect(deps.loadRoutes).not.toHaveBeenCalled();
  });

  it('未登录访问公开页放行', async () => {
    const deps = makeDeps({ isLoggedIn: () => false });
    expect(
      await runGuard(
        createDynamicRouteGuard(deps),
        fakeTo({ meta: { requiresAuth: false }, path: '/public' }),
      ),
    ).toBe(true);
    expect(
      await runGuard(createDynamicRouteGuard(deps), fakeTo({ path: '/login' })),
    ).toBe(true);
  });

  it('菜单只加载一次', async () => {
    let loaded = false;
    const deps = makeDeps({
      isRoutesLoaded: () => loaded,
      loadRoutes: vi.fn(async () => {
        loaded = true;
        return true;
      }),
    });
    const guard = createDynamicRouteGuard(deps);

    await runGuard(guard, fakeTo({ name: 'User', path: '/system/user' }));
    await runGuard(guard, fakeTo({ name: 'Role', path: '/system/role' }));

    expect(deps.loadRoutes).toHaveBeenCalledTimes(1);
  });

  it('菜单加载失败时放行并上报，绝不把导航卡死', async () => {
    const onError = vi.fn();
    const boom = new Error('network down');
    const deps = makeDeps({
      isRoutesLoaded: () => false,
      loadRoutes: vi.fn(async () => {
        throw boom;
      }),
      onError,
    });

    expect(
      await runGuard(createDynamicRouteGuard(deps), fakeTo({ name: 'User', path: '/system/user' })),
    ).toBe(true);
    expect(onError).toHaveBeenCalledWith(boom);
  });

  it('已登录访问访客页回家', async () => {
    const deps = makeDeps();
    expect(
      await runGuard(createDynamicRouteGuard(deps), fakeTo({ path: '/login' })),
    ).toEqual({ path: '/dashboard/analysis', replace: true });
  });

  it('无 name 的路由不参与鉴权（404 兜底、静态外壳）', async () => {
    const deps = makeDeps();
    expect(
      await runGuard(
        createDynamicRouteGuard(deps),
        fakeTo({ path: '/some/unnamed' }),
      ),
    ).toBe(true);
    expect(deps.canAccess).not.toHaveBeenCalled();
  });

  it('canAccess 为 false 时去无权限页', async () => {
    const deps = makeDeps({ canAccess: vi.fn(() => false) });
    expect(
      await runGuard(
        createDynamicRouteGuard(deps),
        fakeTo({ name: 'Export', path: '/system/export' }),
      ),
    ).toEqual({ path: '/403', replace: true });
    expect(deps.canAccess).toHaveBeenCalledWith({
      name: 'Export',
      path: '/system/export',
    });
  });

  it('meta.requiresAuth === false 的静态页不参与菜单鉴权（404 兜底）', async () => {
    const deps = makeDeps({ canAccess: vi.fn(() => false) });
    expect(
      await runGuard(
        createDynamicRouteGuard(deps),
        fakeTo({
          meta: { requiresAuth: false },
          name: 'CatchAll',
          path: '/not-a-page',
        }),
      ),
    ).toBe(true);
    expect(deps.canAccess).not.toHaveBeenCalled();
  });

  it('forbiddenPath 可定制，缺省为 /403', async () => {
    const withDefault = makeDeps({
      canAccess: vi.fn(() => false),
      forbiddenPath: undefined,
    });
    expect(
      await runGuard(
        createDynamicRouteGuard(withDefault),
        fakeTo({ name: 'Export', path: '/system/export' }),
      ),
    ).toEqual({ path: '/403', replace: true });

    const custom = makeDeps({
      canAccess: vi.fn(() => false),
      forbiddenPath: '/no-access',
    });
    expect(
      await runGuard(
        createDynamicRouteGuard(custom),
        fakeTo({ name: 'Export', path: '/system/export' }),
      ),
    ).toEqual({ path: '/no-access', replace: true });
  });

  it('白名单页面即使已登录也不再走权限判断', async () => {
    const deps = makeDeps({ canAccess: vi.fn(() => false) });
    expect(
      await runGuard(
        createDynamicRouteGuard(deps),
        fakeTo({ name: 'Error404', path: '/error/404' }),
      ),
    ).toBe(true);
    expect(deps.canAccess).not.toHaveBeenCalled();
  });

  /**
   * 目录节点落地。
   *
   * 菜单目录（`/dashboard`）没有自己的页面，登录后默认跳过去就是空白内容区，
   * 所以守卫在鉴权通过后要把它换成第一个叶子。
   */
  describe('resolveDirectory —— 目录路径重定向', () => {
    it('目录换成叶子时按 replace 重定向', async () => {
      const deps = makeDeps({
        resolveDirectory: vi.fn((path: string) =>
          path === '/dashboard' ? '/dashboard/analysis' : undefined,
        ),
      });
      expect(
        await runGuard(
          createDynamicRouteGuard(deps),
          fakeTo({ name: 'Dashboard', path: '/dashboard' }),
        ),
      ).toEqual({ path: '/dashboard/analysis', replace: true });
    });

    it('叶子路径原样放行，不做二次跳转', async () => {
      const deps = makeDeps({
        // 应用侧对叶子会返回同一个 path，守卫必须不再重定向（否则自跳自死循环）
        resolveDirectory: (path: string) => path,
      });
      expect(
        await runGuard(
          createDynamicRouteGuard(deps),
          fakeTo({ name: 'Analysis', path: '/dashboard/analysis' }),
        ),
      ).toBe(true);
    });

    it('无权限优先于目录落地：不会把 403 用户重定向到别处', async () => {
      const resolveDirectory = vi.fn(() => '/dashboard/analysis');
      const deps = makeDeps({
        canAccess: vi.fn(() => false),
        resolveDirectory,
      });
      expect(
        await runGuard(
          createDynamicRouteGuard(deps),
          fakeTo({ name: 'Dashboard', path: '/dashboard' }),
        ),
      ).toEqual({ path: '/403', replace: true });
      expect(resolveDirectory).not.toHaveBeenCalled();
    });

    it('目录记录没有 name（文件约定路由的父级）时同样会落地', async () => {
      const deps = makeDeps({
        resolveDirectory: (path: string) =>
          path === '/dashboard' ? '/dashboard/analysis' : undefined,
      });
      expect(
        await runGuard(
          createDynamicRouteGuard(deps),
          fakeTo({ path: '/dashboard' }),
        ),
      ).toEqual({ path: '/dashboard/analysis', replace: true });
      // 父级记录不带 name，不参与菜单鉴权
      expect(deps.canAccess).not.toHaveBeenCalled();
    });

    it('不传 resolveDirectory 时行为与旧版一致', async () => {
      const deps = makeDeps();
      expect(
        await runGuard(
          createDynamicRouteGuard(deps),
          fakeTo({ name: 'Dashboard', path: '/dashboard' }),
        ),
      ).toBe(true);
    });
  });
});
