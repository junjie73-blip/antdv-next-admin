import type { FixtureRoute, HttpMethod } from './types';

export interface NormalizedRequest {
  /** JSON 请求体；非 JSON（FormData / 二进制 / 无体）时为 undefined */
  body: any;
  method: HttpMethod;
  /** 去掉了接口前缀与查询串的绝对路径，例如 `/system/user/list` */
  path: string;
  query: Record<string, string>;
}

export interface NormalizeOptions {
  /** 页面地址：相对 URL 靠它解析，同源判定也以它为基准 */
  baseUrl: string;
  /** 接口前缀（`VITE_APP_BASE_API`），匹配前剥掉；生产构建没配时是空串 */
  prefix: string;
}

export interface RouteMatch {
  params: Record<string, string>;
  route: FixtureRoute;
}

const METHODS = new Set<HttpMethod>(['DELETE', 'GET', 'PATCH', 'POST', 'PUT']);

/** 归一化路径：补前导斜杠、折叠重复斜杠、去掉尾部斜杠，再剥掉接口前缀 */
export function normalizePath(rawPath: string, prefix = ''): string {
  let path = rawPath;
  if (prefix && (path === prefix || path.startsWith(`${prefix}/`))) {
    path = path.slice(prefix.length);
  }
  const withLeading = `/${path}`.replaceAll(/\/{2,}/g, '/');
  const trimmed = withLeading.replace(/\/+$/, '');
  return trimmed || '/';
}

function parseJsonBody(body: BodyInit | null | undefined): any {
  if (typeof body !== 'string') return undefined;
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

/**
 * 把一次 fetch 调用归一化成 `{ method, path, query }`。
 *
 * 返回 `null` 表示「不该由浏览器 mock 处理」：跨域请求（Sentry 上报、CDN）和非 http 协议
 * 都必须原样交给真实 fetch，否则会把站外流量一起劫持进来。
 */
export function normalizeRequest(
  input: RequestInfo | URL,
  init: RequestInit,
  options: NormalizeOptions,
): NormalizedRequest | null {
  const base = new URL(options.baseUrl);
  let href: string;
  if (typeof input === 'string') href = input;
  else if (input instanceof URL) href = input.href;
  else href = input.url;

  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return null;
  }
  if (url.origin !== base.origin) return null;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const rawMethod = String(
    init.method ?? (input as Request).method ?? 'GET',
  ).toUpperCase();
  // HEAD / OPTIONS 之类不参与业务语义，直接放行，别冒充成 POST 被覆盖层改写
  if (!METHODS.has(rawMethod as HttpMethod)) return null;

  return {
    body: parseJsonBody(init.body),
    method: rawMethod as HttpMethod,
    path: normalizePath(url.pathname, options.prefix),
    query: Object.fromEntries(url.searchParams.entries()),
  };
}

function countParams(pattern: string): number {
  return pattern.split('/').filter((segment) => segment.startsWith(':')).length;
}

function matchSegments(
  pattern: string,
  path: string,
): null | Record<string, string> {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (const [index, expected] of patternParts.entries()) {
    const actual = pathParts[index] ?? '';
    if (expected.startsWith(':')) {
      params[expected.slice(1)] = actual;
    } else if (expected !== actual) {
      return null;
    }
  }
  return params;
}

/**
 * 按 method + path 找接口。
 * 同一条路径可能同时存在静态版和参数版（`/system/notice/read-all` 与 `/system/notice/read/:id`），
 * 取参数段最少的那条 —— 静态命中优先，不依赖 fixtures 里的排列顺序。
 */
export function matchRoute(
  routes: FixtureRoute[],
  method: string,
  path: string,
): null | RouteMatch {
  let best: null | RouteMatch = null;
  let bestParams = Number.POSITIVE_INFINITY;

  for (const route of routes) {
    if (route.method !== method) continue;
    const params = matchSegments(route.path, path);
    if (!params) continue;
    const scored = countParams(route.path);
    if (scored < bestParams) {
      best = { params, route };
      bestParams = scored;
    }
  }
  return best;
}
