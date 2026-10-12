import type { FixtureSet } from '../types';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMockFetch, installBrowserMock } from '../browser';

/**
 * 拦截器的三条边界：命中的走 fixtures、没命中的原路透传、跨域的绝不碰。
 * 生产产物里只有这一个出口，任何一条漏了都表现为「部分接口能用、部分 404」。
 */

const fixtures = {
  auth: {
    accounts: [
      {
        password: 'admin123',
        permissions: ['*'],
        profile: { id: '1', username: 'admin' },
        roles: ['admin'],
        username: 'admin',
        visibleMenus: null,
      },
    ],
    failure: { code: 400, data: null, message: '用户名或密码错误' },
    loginPath: '/auth/login',
    logoutPath: '/auth/logout',
    success: {
      code: 200,
      data: { user: { token: 'mock_token_0' } },
      message: '登录成功',
    },
    userPath: '/auth/user-info',
  },
  generatedAt: '2026-01-01T00:00:00.000Z',
  menusPath: '/menus',
  mockServer: 'http://localhost:5320',
  routes: [
    {
      collection: '/system/user',
      listField: 'list',
      method: 'GET' as const,
      path: '/system/user/list',
      response: {
        code: 200,
        data: {
          list: [
            { id: 1, username: 'admin' },
            { id: 2, username: 'bob' },
          ],
          total: 2,
        },
        message: '获取用户列表成功',
      },
      totalField: 'total',
    },
    {
      collection: '/system/user',
      method: 'POST' as const,
      path: '/system/user',
    },
    {
      collection: '/menus',
      method: 'GET' as const,
      path: '/menus',
      response: { code: 200, data: { list: [] }, message: '获取菜单成功' },
    },
  ],
} satisfies FixtureSet;

const BASE_URL = 'http://localhost:9080/index.html';

function makeNativeFetch(reply?: Response) {
  const spy = vi.fn(() =>
    Promise.resolve(
      reply ??
        new Response('{}', { headers: { 'content-type': 'application/json' } }),
    ),
  );
  return spy as unknown as ReturnType<typeof vi.fn> & typeof fetch;
}

function mockFetch(nativeFetch: typeof fetch, latency = () => 0) {
  return createMockFetch(fixtures, {
    baseUrl: BASE_URL,
    latency,
    nativeFetch,
    prefix: '/api',
  });
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('createMockFetch', () => {
  it('命中 fixtures 时返回 JSON 信封，不发真实请求', async () => {
    const nativeFetch = makeNativeFetch();
    const response = await mockFetch(nativeFetch)(
      '/api/system/user/list?pageSize=1',
    );

    expect(nativeFetch).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    const body = await response.json();
    expect(body).toEqual({
      code: 200,
      data: { list: [{ id: 1, username: 'admin' }], total: 2 },
      message: '获取用户列表成功',
    });
  });

  it('带请求体的 POST 也走覆盖层，随后的列表读能查到', async () => {
    const fetchMock = mockFetch(makeNativeFetch());
    await fetchMock('/api/system/user', {
      body: JSON.stringify({ username: 'carol' }),
      method: 'POST',
    });
    const response = await fetchMock('/api/system/user/list?pageSize=10');
    const body = await response.json();
    expect(body.data.total).toBe(3);
    expect(body.data.list.at(-1).username).toBe('carol');
  });

  it('未命中的路径原样透传，参数一字不改地交给真实 fetch', async () => {
    const nativeFetch = makeNativeFetch();
    const init = { method: 'POST' };
    await mockFetch(nativeFetch)('/api/system/not-captured', init);

    expect(nativeFetch).toHaveBeenCalledTimes(1);
    expect(nativeFetch.mock.calls[0]).toEqual([
      '/api/system/not-captured',
      init,
    ]);
  });

  it('跨域请求不劫持（Sentry 上报、CDN 都在这一类）', async () => {
    const nativeFetch = makeNativeFetch();
    await mockFetch(nativeFetch)(
      'https://o1.ingest.sentry.io/api/42/envelope/',
    );
    expect(nativeFetch).toHaveBeenCalledTimes(1);
  });

  it('应答带几十毫秒的模拟延迟，不是 0', async () => {
    const startedAt = Date.now();
    // 不传 latency，走默认的 20-60ms 随机档
    await createMockFetch(fixtures, {
      baseUrl: BASE_URL,
      nativeFetch: makeNativeFetch(),
      prefix: '/api',
    })('/menus');
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(20);
  });
});

describe('installBrowserMock', () => {
  it('装上后 globalThis.fetch 就是拦截器，卸载函数能把原函数还回来', async () => {
    const nativeFetch = makeNativeFetch();
    globalThis.fetch = nativeFetch;
    const uninstall = installBrowserMock({
      baseUrl: BASE_URL,
      fixtures,
      nativeFetch,
      prefix: '/api',
    });

    const response = await globalThis.fetch('/api/menus');
    const body = await response.json();
    expect(body.message).toBe('获取菜单成功');

    uninstall();
    expect(globalThis.fetch).toBe(nativeFetch);
  });

  it('重复安装不再套一层，拿到的还是同一个卸载函数', () => {
    const nativeFetch = makeNativeFetch();
    globalThis.fetch = nativeFetch;
    const deps = { baseUrl: BASE_URL, fixtures, nativeFetch, prefix: '/api' };
    const first = installBrowserMock(deps);
    const patched = globalThis.fetch;
    expect(installBrowserMock(deps)).toBe(first);
    expect(globalThis.fetch).toBe(patched);
    first();
  });
});
