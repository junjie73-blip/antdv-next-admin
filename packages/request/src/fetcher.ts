import type { ApiResponse } from './types';

import { message, notification } from '@antdv/popup-ui';
import {
  config as csrfConfig,
  getCsrfToken,
  initCsrfProtection,
} from '@antdv/shared/utils/csrf';
import { isTokenExpired } from '@antdv/shared/utils/jwt';
import { createFetch } from '@vueuse/core';

import { ErrorCode, isServerFailure, RequestError } from './error';
import { getRequestRuntime, loginPathOfRuntime } from './runtime';

/** 凭证头名；服务端网关只认这一个写法，应用侧不要再传别的 */
export const AUTHORIZATION_KEY = 'Authorization';

const AUTH_ENDPOINTS = [
  '/auth/login',
  '/auth/logout',
  '/auth/refresh',
  '/auth/register',
  '/auth/captcha',
  '/tenant/options',
  '/auth/forgot-password',
  '/auth/password-policy',
];
const STATE_CHANGING = new Set(['DELETE', 'PATCH', 'POST', 'PUT']);

/** HTTP 层成功范围；业务成败只看 2xx 信封里的 code，不把业务失败当 HTTP 故障 */
function isHttpSuccess(status: number): boolean {
  return status >= 200 && status < 300;
}

/** 状态码的人话兜底：非 JSON / 无 body 的 HTTP 错误不能把 HTML 或空文案弹给用户 */
const STATUS_FALLBACK: Record<number, string> = {
  400: '请求参数有误',
  401: '登录已过期，请重新登录',
  403: '没有操作权限',
  404: '请求的资源不存在',
  408: '请求超时，请稍后重试',
  429: '操作过于频繁，请稍后再试',
};

function statusFallback(status: number, fallback = '请求失败'): string {
  if (!status) return '网络连接异常，请检查网络后重试';
  return STATUS_FALLBACK[status] ?? (status >= 500 ? '服务器繁忙，请稍后重试' : fallback);
}

/** 字符串 body 可能是 JSON 文本，也可能是 HTML/纯文本；统一归一后再取错误文案 */
function parsePayload(data: unknown): unknown {
  if (typeof data !== 'string') return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

/** HTTP 错误时 vueuse 只给 statusText，错误详情要从 response 的克隆里再读一次 */
async function readErrorBody(response?: Response | null): Promise<unknown> {
  if (!response) return null;
  try {
    const clone = response.clone();
    const text = await clone.text().catch(() => '');
    return text ? parsePayload(text) : null;
  } catch {
    return null;
  }
}

let csrfInitialized = false;
let refreshPromise: null | Promise<string> = null;
let isLoggingOut = false;

export function isAuthEndpoint(url?: string) {
  return !!url && AUTH_ENDPOINTS.some((p) => url.includes(p));
}

/**
 * hash 路由下的"当前站内路径"：`#/system/user?x=1` → `/system/user?x=1`。
 *
 * 不能读 `window.location.pathname` —— 本应用用 `createWebHashHistory`，pathname
 * 永远是 `/`，站内路径全在 hash 里。
 */
function currentRoutePath(): string {
  const hash = window.location.hash;
  return hash.length > 1 ? hash.slice(1) : '/';
}

/** 是否已经在登录页（含带 redirect 参数的登录页） */
function isOnLoginPath(path: string): boolean {
  const loginPath = loginPathOfRuntime();
  return (
    path === loginPath ||
    path.startsWith(`${loginPath}?`) ||
    path.startsWith(`${loginPath}/`)
  );
}

/**
 * 会话失效（401 / 无凭证 / 刷新失败）时的统一收尾。
 *
 * 两件事必须一起做，之前都做错了：
 * 1. 清状态。旧写法在 store 外面手抄 `token = ''`（还带一层 `as any`），
 *    漏掉用户信息、页面缓存、菜单授权与标签页 —— 换账号进来会带上一人的残影。
 *    现在交给应用注入的 `onLogout`，它走 store 的那个唯一出口。
 * 2. 回登录页。本应用是 **hash 路由**（`createWebHashHistory`），登录页地址是
 *    `/#/login`；`window.location.href = '/login?...'` 写的是 pathname，路由表里
 *    没有这条真实路径，于是触发一次整页重载：正在跑的导航被打断
 *    （e2e 里就是 "Execution context was destroyed"），拼上去的 redirect 也丢了。
 *    改 hash 才是一次站内导航，由守卫接手重定向。
 */
export function forceLogout(redirect = true): void {
  if (isLoggingOut) return;
  isLoggingOut = true;
  getRequestRuntime().onLogout();

  if (redirect) {
    const current = currentRoutePath();
    if (!isOnLoginPath(current)) {
      window.location.hash = `#${loginPathOfRuntime()}?redirect=${encodeURIComponent(current)}`;
    }
  }

  setTimeout(() => {
    isLoggingOut = false;
  }, 5000);
}

export function resetLogoutFlag(): void {
  isLoggingOut = false;
}

async function doRefreshToken(baseUrl: string): Promise<string> {
  const { tokens } = getRequestRuntime();
  const refreshTokenValue = tokens.refresh();
  if (!refreshTokenValue) throw new Error('缺少 refresh token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    // 只认凭证来源里的明文 token：缓存里存的是 JWE 密文，当凭证发出去必然 401
    [AUTHORIZATION_KEY]: `Bearer ${tokens.access() ?? ''}`,
  };
  try {
    const csrf = await getCsrfToken();
    if (csrf?.value) headers[csrfConfig.headerName] = csrf.value;
  } catch {
    /* ignore */
  }

  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/auth/refresh`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ refreshToken: refreshTokenValue }),
  });
  // JSON null 是合法的解析结果：网关兜底返回 null 时，旧代码读 payload.code
  // 会抛 "Cannot read properties of null"，把「刷新服务不可用」变成前端异常。
  const parsed: unknown = await res.json().catch(() => null);
  const payload = (parsed && typeof parsed === 'object'
    ? parsed
    : {}) as ApiResponse<{
    accessToken: string;
    refreshToken?: string;
  }>;
  if (
    !res.ok ||
    (payload.code !== undefined && payload.code !== ErrorCode.SUCCESS)
  ) {
    throw new Error(payload.message || `刷新令牌失败 (${res.status})`);
  }
  const newAccess = payload.data?.accessToken;
  const newRefresh = payload.data?.refreshToken ?? refreshTokenValue;
  if (!newAccess) throw new Error('刷新接口未返回 accessToken');
  // accessToken 的持久化由凭证来源负责（它写的是密文）；这里再塞一次明文会把密文覆盖掉，
  // 于是缓存里的值没法当凭证用。
  await tokens.setAccess(newAccess);
  tokens.setRefresh(newRefresh);
  return newAccess;
}

function getRefreshPromise(baseUrl: string): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = doRefreshToken(baseUrl).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/** 供 executor 在收到响应式 401 后主动刷新；baseUrl 与 createFetcher 默认值保持一致 */
export function refreshAccessToken(): Promise<string> {
  return getRefreshPromise(getRequestRuntime().baseUrl);
}

/** 刷新期间可能已触发 forceLogout，用于避免重复刷新与重放 */
export function isLoggingOutNow(): boolean {
  return isLoggingOut;
}

export interface CreateFetcherOptions {
  baseUrl?: string;
  timeout?: number;
}

export function createFetcher(opts: CreateFetcherOptions = {}) {
  const runtime = getRequestRuntime();
  const baseUrl = opts.baseUrl ?? runtime.baseUrl ?? '';
  const defaultTimeout = opts.timeout ?? runtime.timeout ?? 30_000;

  if (!csrfInitialized) {
    initCsrfProtection({
      headerName: 'X-CSRF-Token',
      doubleSubmit: true,
      autoRotate: true,
    });
    csrfInitialized = true;
  }

  return createFetch({
    baseUrl,
    combination: 'overwrite',
    // ⭐ 这里只放 RequestInit（fetch 原生选项）
    fetchOptions: {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    },
    // ⭐ 这里放 UseFetchOptions
    options: {
      timeout: defaultTimeout,

      async beforeFetch({ options: fetchOptions, url }) {
        const method = (fetchOptions.method || 'GET').toUpperCase();
        const isAuth = isAuthEndpoint(url);

        if (!isAuth) {
          const { tokens } = getRequestRuntime();
          // 凭证来源是 token 的唯一出口：入口挂载前应用会把缓存里的密文解开设进 store，
          // 直接回退去读缓存等于把 JWE 当凭证发出去（每次刷新都 401）
          const accessToken = tokens.access();
          const refreshToken = tokens.refresh();

          if (!accessToken) {
            if (refreshToken) {
              try {
                await getRefreshPromise(baseUrl);
              } catch {
                forceLogout();
                throw new RequestError('登录已过期，请重新登录', {
                  status: 401,
                  code: ErrorCode.UNAUTHORIZED,
                });
              }
            } else {
              forceLogout();
              throw new RequestError('未登录', {
                status: 401,
                code: ErrorCode.UNAUTHORIZED,
              });
            }
          } else if (isTokenExpired(accessToken, 60) && refreshToken) {
            try {
              await getRefreshPromise(baseUrl);
            } catch {
              /* 用旧 token 继续 */
            }
          }

          const finalToken = tokens.access();
          if (finalToken) {
            fetchOptions.headers = {
              ...fetchOptions.headers,
              [AUTHORIZATION_KEY]: `Bearer ${finalToken}`,
            };
          }
        }

        if (STATE_CHANGING.has(method)) {
          try {
            const csrf = await getCsrfToken();
            if (csrf?.value) {
              fetchOptions.headers = {
                ...fetchOptions.headers,
                [csrfConfig.headerName]: csrf.value,
              };
            }
          } catch {
            /* ignore */
          }
        }

        const isFormData = fetchOptions.body instanceof FormData;
        fetchOptions.headers = {
          ...fetchOptions.headers,
          'Content-Type': isFormData
            ? undefined
            : (fetchOptions.headers as any)?.['Content-Type'] ||
              'application/json; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          ...(STATE_CHANGING.has(method)
            ? { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
            : {}),
        };

        return { options: fetchOptions };
      },

      async afterFetch({ data, response }) {
        const payload = parsePayload(data);

        // HTTP 非 2xx 一律失败，哪怕 body 是 HTML/blob/text（网关 404 常见）；
        // vueuse 通常在 afterFetch 前就抛了，这里保留兜底，保证所有版本都拦得到。
        if (!isHttpSuccess(response.status)) {
          throw new RequestError(
            resolveErrorMessage(
              payload,
              statusFallback(response.status),
              response.status,
            ),
            {
              data: payload,
              status: response.status,
              statusText: response.statusText,
              code: response.status,
            },
          );
        }

        const contentType = response.headers.get('content-type') ?? '';
        // 2xx 非 JSON（blob / arrayBuffer / text / 二进制）直接透传
        if (!contentType.includes('application/json')) {
          return { data };
        }

        // 2xx JSON：业务码失败是"操作反馈"，不是 HTTP 故障，交给 message 通道
        const bodyCode: number | undefined =
          payload && typeof payload === 'object' && 'code' in payload
            ? (payload as ApiResponse).code
            : undefined;

        if (bodyCode !== undefined && bodyCode !== ErrorCode.SUCCESS) {
          throw new RequestError(
            resolveErrorMessage(payload, '请求失败', response.status, bodyCode),
            {
              data: payload,
              status: response.status,
              statusText: response.statusText,
              code: bodyCode,
            },
          );
        }

        return { data: payload };
      },

      async onFetchError({ error, response }) {
        // 所有失败从这一个口子收口：afterFetch 抛出的业务码错误、HTTP 非 2xx、
        // 网络异常，以及 beforeFetch 的会话失效。旧的早退分支会让业务码错误
        // 绕过错误上报，登录密码输错时全局状态就一直是「健康」。
        const status = response?.status ?? 0;
        const body = await readErrorBody(response);
        const err =
          error instanceof RequestError
            ? error
            : new RequestError(
                resolveErrorMessage(body, statusFallback(status), status),
                {
                  data: body,
                  status,
                  statusText: response?.statusText,
                  code: status || undefined,
                },
              );

        getRequestRuntime().onError?.(err);
        reportRequestError(err);
        throw err;
      },
    },
  });
}

export function resolveErrorMessage(
  data: unknown,
  fallback: string,
  status?: number,
  code?: number,
): string {
  if (isServerFailure(status ?? 0, code)) {
    if (data && typeof data === 'object' && 'message' in data)
      return String((data as any).message);
    return '服务器繁忙，请稍后重试';
  }
  if (typeof data === 'string') {
    const text = data.trim();
    // HTML / XML 错误页不该整段弹给用户，让状态码兜底文案接管
    if (text && !text.startsWith('<')) return text.slice(0, 200);
  }
  if (typeof data === 'object' && data !== null) {
    if ('message' in data && typeof (data as any).message === 'string')
      return (data as any).message;
    if ('msg' in data && typeof (data as any).msg === 'string')
      return (data as any).msg;
  }
  return fallback || statusFallback(status ?? 0);
}

/**
 * 提示口径的唯一收口：
 * - HTTP 非 2xx（含网络异常）是"服务层出了问题"，用 notification 全局通知；
 * - HTTP 2xx 只是业务码/校验失败，是"这次操作没成功"，用 message 轻提示。
 * 两条通道都不在这里报成功：成功后的操作反馈由调用方按场景决定。
 */
function reportRequestError(error: RequestError) {
  if (error.handled) return;
  const description = resolveErrorMessage(
    error.data,
    error.message || statusFallback(error.status),
    error.status,
    error.code,
  );
  if (!isHttpSuccess(error.status)) {
    notification.error('请求失败', { description });
    return;
  }
  message.error(description);
}
