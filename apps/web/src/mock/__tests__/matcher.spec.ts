import type { FixtureRoute } from '../types';

import { describe, expect, it } from 'vitest';

import { matchRoute, normalizePath, normalizeRequest } from '../matcher';

/**
 * 路径归一化与接口匹配是拦截器的唯一判入口：
 * 判错了不是"数据不对"，而是整个请求静默走真网络，生产环境直接 404。
 */

const OPTIONS = { baseUrl: 'http://localhost:9080/', prefix: '/api' };

function route(method: string, path: string): FixtureRoute {
  return { method: method as FixtureRoute['method'], path };
}

const routes: FixtureRoute[] = [
  route('GET', '/menus'),
  route('GET', '/system/user/list'),
  route('GET', '/system/user/:id'),
  route('PUT', '/system/notice/read/:id'),
  route('PUT', '/system/notice/read-all'),
  route('POST', '/system/user'),
];

describe('normalizePath —— 前缀与斜杠', () => {
  it('剥掉接口前缀，补前导斜杠、去掉尾部斜杠', () => {
    expect(normalizePath('/api/system/user/list', '/api')).toBe(
      '/system/user/list',
    );
    expect(normalizePath('system/user/', '')).toBe('/system/user');
    expect(normalizePath('//system//user//', '')).toBe('/system/user');
  });

  it('前缀只在作为独立路径段时才剥，别把 /apifoo 削成 /foo', () => {
    expect(normalizePath('/apifoo', '/api')).toBe('/apifoo');
    expect(normalizePath('/api', '/api')).toBe('/');
  });
});

describe('normalizeRequest —— method / path / query', () => {
  it('相对地址按页面地址解析，查询串不进 path 只进 query', () => {
    const request = normalizeRequest(
      '/api/system/user/list?pageNum=2&keyword=张',
      { method: 'get' },
      OPTIONS,
    );
    expect(request?.path).toBe('/system/user/list');
    expect(request?.method).toBe('GET');
    expect(request?.query).toEqual({ keyword: '张', pageNum: '2' });
  });

  it('请求体是 JSON 才解析成对象，非 JSON（FormData / 二进制）一律 undefined', () => {
    expect(
      normalizeRequest(
        '/system/user',
        { body: '{"username":"a"}', method: 'POST' },
        OPTIONS,
      )?.body,
    ).toEqual({ username: 'a' });
    expect(
      normalizeRequest(
        '/system/user',
        { body: 'not-json', method: 'POST' },
        OPTIONS,
      )?.body,
    ).toBeUndefined();
  });

  it('跨域与非 http 协议返回 null：站外流量必须原样放行', () => {
    expect(
      normalizeRequest(
        'https://o1.ingest.sentry.io/api/42/envelope/',
        {},
        OPTIONS,
      ),
    ).toBeNull();
    expect(
      normalizeRequest('blob:http://localhost:9080/xxx', {}, OPTIONS),
    ).toBeNull();
  });

  it('其余方法（HEAD、OPTIONS）不冒充业务方法，交给真实 fetch', () => {
    expect(normalizeRequest('/menus', { method: 'HEAD' }, OPTIONS)).toBeNull();
  });
});

describe('matchRoute —— method + path', () => {
  it('静态路径命中，参数段捕获值', () => {
    expect(matchRoute(routes, 'GET', '/menus')?.route.path).toBe('/menus');
    expect(matchRoute(routes, 'GET', '/system/user/7')).toEqual({
      params: { id: '7' },
      route: route('GET', '/system/user/:id'),
    });
  });

  it('静态与参数同时可命中时取静态那条', () => {
    expect(
      matchRoute(routes, 'PUT', '/system/notice/read-all')?.route.path,
    ).toBe('/system/notice/read-all');
    expect(matchRoute(routes, 'PUT', '/system/notice/read/9')?.params).toEqual({
      id: '9',
    });
  });

  it('method 不同不算命中，段数不同也不算', () => {
    expect(matchRoute(routes, 'POST', '/menus')).toBeNull();
    expect(matchRoute(routes, 'GET', '/system/user')).toBeNull();
    expect(matchRoute(routes, 'GET', '/system/user/1/children')).toBeNull();
  });
});
