import type { ApiResponse } from './types';

import { createFetch } from '@vueuse/core';
import { notification } from 'antdv-next';
import { AUTHORIZATION_KEY } from '~/composables/constant';
import { REFRESH_TOKEN_KEY, TOKEN_KEY } from '~/config/constants';
import { useUserStore } from '~/stores/modules/user';
import { cache } from '~/utils';
import {
  config as csrfConfig,
  getCsrfToken,
  initCsrfProtection,
} from '~/utils/csrf';
import { isTokenExpired } from '~/utils/jwt';

import { ErrorCode, isServerFailure, RequestError } from './error';

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
const SILENT_CODES = new Set<number>([ErrorCode.UNAUTHORIZED]);

let csrfInitialized = false;
let refreshPromise: null | Promise<string> = null;
let isLoggingOut = false;

export function isAuthEndpoint(url?: string) {
  return !!url && AUTH_ENDPOINTS.some((p) => url.includes(p));
}

export function forceLogout(redirect = true): void {
  if (isLoggingOut) return;
  isLoggingOut = true;
  const userStore = useUserStore();
  const s = userStore as any;
  if (typeof s.resetToken === 'function') s.resetToken();
  else if (typeof s.clearToken === 'function') s.clearToken();
  else {
    s.token = '';
    s.refreshToken = '';
  }

  if (redirect && window.location.pathname !== '/login') {
    window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
  }
  setTimeout(() => {
    isLoggingOut = false;
  }, 5000);
}

export function resetLogoutFlag(): void {
  isLoggingOut = false;
}

async function doRefreshToken(baseUrl: string): Promise<string> {
  const userStore = useUserStore();
  const refreshTokenValue =
    userStore.refreshToken || cache.getItem(REFRESH_TOKEN_KEY);
  if (!refreshTokenValue) throw new Error('缺少 refresh token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    [AUTHORIZATION_KEY]: `Bearer ${userStore.token || cache.getItem(TOKEN_KEY)}`,
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
  const payload = (await res.json().catch(() => ({}))) as ApiResponse<{
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
  userStore.setToken(newAccess, newRefresh);
  cache.setItem(TOKEN_KEY, newAccess);
  cache.setItem(REFRESH_TOKEN_KEY, newRefresh);
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
  return getRefreshPromise(import.meta.env.VITE_APP_BASE_API ?? '');
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
  const baseUrl = opts.baseUrl ?? import.meta.env.VITE_APP_BASE_API ?? '';
  const defaultTimeout = opts.timeout ?? 30_000;

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
          const userStore = useUserStore();
          const accessToken = userStore.token || cache.getItem(TOKEN_KEY);
          const refreshToken =
            userStore.refreshToken || cache.getItem(REFRESH_TOKEN_KEY);

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

          const finalToken = useUserStore().token || cache.getItem(TOKEN_KEY);
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
        const contentType = response.headers.get('content-type') ?? '';

        // ⭐ 非 JSON（blob / arrayBuffer / text / 二进制）直接透传
        if (!contentType.includes('application/json')) {
          return { data };
        }

        // ⭐ JSON：解析并检查业务码
        let payload: any = data;
        if (typeof data === 'string') {
          try {
            payload = JSON.parse(data);
          } catch {
            /* keep */
          }
        }

        const bodyCode: number | undefined =
          payload && typeof payload === 'object' && 'code' in payload
            ? (payload as ApiResponse).code
            : undefined;

        if (bodyCode !== undefined && bodyCode !== ErrorCode.SUCCESS) {
          const err = new RequestError(
            resolveErrorMessage(payload, '请求失败', response.status, bodyCode),
            {
              data: payload,
              status: response.status,
              code: bodyCode,
            },
          );
          err.handled = true; // ⭐ 避免 onFetchError 重复弹 toast
          throw err;
        }

        return { data: payload };
      },

      async onFetchError({ error, response }) {
        // 已经是业务层错误（afterFetch 抛出的），保持原样
        if (error instanceof RequestError) {
          if (!error.handled) reportRequestError(error);
          throw error;
        }

        const status = response?.status ?? 0;
        const err = new RequestError(
          resolveErrorMessage(
            null,
            (error as any)?.message || '请求失败',
            status,
          ),
          {
            status,
            code: status,
          },
        );
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
  if (typeof data === 'object' && data !== null) {
    if ('message' in data && typeof (data as any).message === 'string')
      return (data as any).message;
    if ('msg' in data && typeof (data as any).msg === 'string')
      return (data as any).msg;
  }
  return fallback;
}

async function reportRequestError(error: RequestError) {
  if (error.handled || SILENT_CODES.has(error.code)) return;
  if (isServerFailure(error.status, error.code)) {
    notification.error({
      title: '请求错误',
      description: error.message || '服务器繁忙，请稍后重试',
    });
    return;
  }
  notification.error({
    title: '请求错误',
    description: resolveErrorMessage(
      error.data,
      error.message,
      error.status,
      error.code,
    ),
  });
}
