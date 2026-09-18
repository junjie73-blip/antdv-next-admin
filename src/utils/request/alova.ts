import { createAlova } from "alova";
import adapterFetch from "alova/fetch";
import VueHook from "alova/vue";
import { message, notification } from "antdv-next";

import { AUTHORIZATION_KEY } from "./constant";

import type { RequestMeta } from "./interface";

import router from "@/router";
import { useUserStore } from "@/stores/modules/user";
import { config as csrfConfig, getCsrfToken, initCsrfProtection } from "@/utils/csrf";

// ==================== 业务错误码（与后端 errorHandler 对齐）====================
export const ErrorCode = {
  SUCCESS: 200,

  // 4xx 业务码
  VALIDATION_FAILED: 400001,
  UNAUTHORIZED: 401001,
  FORBIDDEN: 403001,
  NOT_FOUND: 404001,
  BLOCKED: 403,

  // 5xx 业务码（后端显式映射的）
  INTERNAL_ERROR: 500000,

  // 网关 / 代理 / Node 原生 HTTP 5xx（无业务码，直接用 HTTP status）
  HTTP_BAD_GATEWAY: 502,
  HTTP_SERVICE_UNAVAILABLE: 503,
  HTTP_GATEWAY_TIMEOUT: 504,
} as const;
const AUTH_ENDPOINTS = ["/auth/login", "/auth/logout", "/auth/refresh"];

function isAuthEndpoint(url?: string): boolean {
  if (!url) return false;
  return AUTH_ENDPOINTS.some((p) => url.includes(p));
}
/** 响应体结构 */
export interface ApiResponse<T = unknown> {
  code: number;
  message?: string;
  timestamp?: number;
  data?: T;
}

/** 不需要弹 toast 的错误码（由刷新逻辑、跳转逻辑等单独处理） */
const SILENT_ERROR_CODES = new Set<number>([
  ErrorCode.UNAUTHORIZED, // 401 走刷新或跳登录，不弹 toast
]);

/** 是否是需要触发"无感刷新"的认证错误 */
function isUnauthorized(status: number, code?: number): boolean {
  return status === 401 || code === ErrorCode.UNAUTHORIZED;
}
/** 业务码 5xxxxx 也可重试（除 500000 已包含在 HTTP 5xx 内） */
function isRetryable(error: AlovaRequestError): boolean {
  if (RETRYABLE_STATUS_CODES.has(error.status)) return true;
  // 业务码 5xxxxx：服务器端故障，可重试
  if (isServerErrorCode(error.code)) return true;
  return false;
}

// ==================== 类型 & 错误类 ====================
interface CreateRequestClientOptions {
  customFetch?: typeof fetch;
  baseURL?: string;
  maxRetries?: number;
  enableCache?: boolean;
  cacheExpireTime?: number;
  timeout?: number;
}
/** HTTP 5xx 状态集合（用于判定是否为服务器端故障） */
const SERVER_ERROR_STATUS = new Set([500, 501, 502, 503, 504, 505, 507, 508, 510, 511]);
function isServerErrorCode(code?: number): boolean {
  return code !== undefined && code >= 500000 && code < 600000;
}

/** 综合判断：HTTP 5xx 或业务码 5xxxxx */
function isServerFailure(status: number, code?: number): boolean {
  return SERVER_ERROR_STATUS.has(status) || isServerErrorCode(code);
}
let isLoggingOut = false;

/** 全局登出：清状态 + 跳登录，幂等，只在首次真正执行 */
export function forceLogout(redirect = true): void {
  if (isLoggingOut) return;
  isLoggingOut = true;

  const userStore = useUserStore();

  // 只清本地状态，绝不再调会发请求的 logout()
  const store = userStore as any;
  if (typeof store.resetToken === "function") {
    store.resetToken();
  } else if (typeof store.clearToken === "function") {
    store.clearToken();
  } else {
    // 兜底：至少把 token 清掉，不要走 logout()
    store.token = "";
    store.refreshToken = "";
  }

  if (redirect && router.currentRoute.value.path !== "/login") {
    router.replace({
      path: "/login",
      query: { redirect: router.currentRoute.value.fullPath },
    });
  }
}
export function resetLogoutFlag(): void {
  isLoggingOut = false;
}
const SERVER_ERROR_MESSAGE = "服务器繁忙，请稍后重试";
class AlovaRequestError<T = unknown> extends Error {
  data?: T;
  status: number;
  statusText: string;
  retryCount: number;
  /** 后端业务码（来自 body.code） */
  code: number;
  /** 是否已被上层处理过（例如刷新失败），避免重复提示 */
  handled = false;

  constructor(
    message: string,
    options: {
      data?: T;
      status: number;
      statusText: string;
      code?: number;
      retryCount?: number;
    },
  ) {
    super(message);
    this.name = "RequestError";
    this.data = options.data;
    this.status = options.status;
    this.statusText = options.statusText;
    this.code = options.code ?? options.status;
    this.retryCount = options.retryCount ?? 0;
  }
}

const RETRYABLE_STATUS_CODES = new Set([
  408, 429, 500, 501, 502, 503, 504, 505, 507, 508, 510, 511,
]);
const CACHEABLE_METHODS = new Set(["GET", "HEAD"]);
const STATE_CHANGING_METHODS = ["POST", "PUT", "PATCH", "DELETE"];
const pendingRequests = new Map<string, Promise<any>>();

let csrfInitialized = false;

// ==================== 主工厂 ====================
export function createRequestClient(options: CreateRequestClientOptions = {}) {
  const {
    customFetch,
    baseURL = import.meta.env.VITE_APP_BASE_API || "",
    maxRetries = 3,
    enableCache = false,
    cacheExpireTime = 5 * 60 * 1000,
    timeout = 30000,
  } = options;

  const fetchAdapter = adapterFetch({ customFetch });

  // ---------------- 无感刷新：单例 ----------------
  let refreshPromise: Promise<string> | null = null;

  async function doRefreshToken(): Promise<string> {
    const userStore = useUserStore();
    const refreshTokenValue = userStore.refreshToken;
    if (!refreshTokenValue) throw new Error("缺少 refresh token");

    const headers: Record<string, string> = {
      "Content-Type": "application/json; charset=utf-8",
      [AUTHORIZATION_KEY]: `Bearer ${userStore.token}`,
    };

    try {
      const csrfToken = await getCsrfToken();
      if (csrfToken?.value) headers[csrfConfig.headerName] = csrfToken.value;
    } catch {
      console.warn("[Security] CSRF Token 获取失败，刷新请求继续");
    }

    // 用原生 fetch 绕开 alova，避免递归
    const response = await fetch(`${baseURL.replace(/\/$/, "")}/auth/refresh`, {
      method: "POST",
      headers,
      body: JSON.stringify({ refreshToken: refreshTokenValue }),
    });

    const payload = (await response.json().catch(() => ({}))) as ApiResponse<{
      accessToken: string;
      refreshToken?: string;
    }>;

    // 按后端规范：HTTP 200 + body.code === 200 才算刷新成功
    if (!response.ok || (payload.code !== undefined && payload.code !== ErrorCode.SUCCESS)) {
      throw new Error(payload.message || `刷新令牌失败 (${response.status})`);
    }

    const newAccessToken = payload.data?.accessToken;
    const newRefreshToken = payload.data?.refreshToken ?? refreshTokenValue;
    if (!newAccessToken) throw new Error("刷新接口未返回 accessToken");

    userStore.setToken({ token: newAccessToken, refreshToken: newRefreshToken });
    return newAccessToken;
  }

  function getRefreshPromise(): Promise<string> {
    if (!refreshPromise) {
      refreshPromise = doRefreshToken().finally(() => {
        refreshPromise = null;
      });
    }
    return refreshPromise;
  }

  /** 刷新失败：清状态 + 跳登录 + 返回一个 handled 的错误 */
  function handleRefreshFailure(originalError?: unknown): AlovaRequestError {
    const userStore = useUserStore();
    (userStore as any).logout?.() ??
      (userStore as any).resetToken?.() ??
      (userStore as any).clearToken?.();

    if (router.currentRoute.value.path !== "/login") {
      router.replace({
        path: "/login",
        query: { redirect: router.currentRoute.value.fullPath },
      });
    }

    const err = new AlovaRequestError("登录已过期，请重新登录", {
      status: 401,
      statusText: "Unauthorized",
      code: ErrorCode.UNAUTHORIZED,
      data: originalError,
    });
    err.handled = true;
    return err;
  }

  return createAlova({
    baseURL,
    requestAdapter: fetchAdapter,
    shareRequest: true,
    statesHook: VueHook,
    timeout,

    async beforeRequest(method) {
      // ---------- CSRF 初始化 ----------
      if (!csrfInitialized) {
        initCsrfProtection({
          headerName: "X-CSRF-Token",
          doubleSubmit: true,
          autoRotate: true,
        });
        csrfInitialized = true;
      }

      // ---------- Authorization ----------
      if (method.config.meta?.token !== false) {
        const userStore = useUserStore();
        if (userStore.token) {
          method.config.headers = {
            ...method.config.headers,
            [AUTHORIZATION_KEY]: `Bearer ${userStore.token}`,
          };
        }
      }

      // ---------- CSRF Token ----------
      const methodType = (method.type as string).toUpperCase();
      if (STATE_CHANGING_METHODS.includes(methodType)) {
        try {
          const csrfToken = await getCsrfToken();
          if (csrfToken?.value) {
            method.config.headers = {
              ...method.config.headers,
              [csrfConfig.headerName]: csrfToken.value,
            };
          }
        } catch {
          console.warn("[Security] CSRF Token 获取失败，继续请求");
        }
      }

      // ---------- 通用安全头 ----------
      const isFormData = method.data instanceof FormData;
      method.config.headers = {
        ...method.config.headers,
        "Content-Type": isFormData
          ? undefined
          : method.config.headers?.["Content-Type"] || "application/json; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        ...(STATE_CHANGING_METHODS.includes(methodType)
          ? { "Cache-Control": "no-store, no-cache, must-revalidate" }
          : {}),
      };

      // ---------- 请求去重 ----------
      if (!CACHEABLE_METHODS.has(method.type as string)) {
        const requestKey = getRequestKey(method);
        if (pendingRequests.has(requestKey)) {
          method.response = () => pendingRequests.get(requestKey)!;
        } else {
          const originalResponse = method.response;
          if (originalResponse) {
            const requestPromise = originalResponse().finally(() => {
              clearPendingRequest(method);
            });
            pendingRequests.set(requestKey, requestPromise);
            method.response = () => requestPromise;
          }
        }
      }

      // ---------- GET 缓存 ----------
      if (enableCache && CACHEABLE_METHODS.has(method.type as string)) {
        method.config.cacheFor = {
          mode: "memory",
          expire: cacheExpireTime,
          tag: method.url + JSON.stringify(method.params ?? {}),
        };
      }
    },

    responded: {
      async onSuccess(response, method) {
        // ==================== ⭐ Blob / ArrayBuffer 短路 ====================
        const responseType = method.config.meta?.responseType;

        if (responseType === "blob" || responseType === "arrayBuffer") {
          // 成功：直接返回原始二进制
          if (response.ok) {
            return responseType === "blob" ? await response.blob() : await response.arrayBuffer();
          }

          // 失败：此时后端通常会返回 JSON 错误体，尝试解析
          // 但此时 body 已经是二进制/文本，需要重新读
          let errorPayload: any = null;
          try {
            const cloned = response.clone();
            const text = await cloned.text();
            errorPayload = JSON.parse(text);
          } catch {
            // 不是 JSON，忽略
          }

          const bodyCode: number | undefined =
            errorPayload && typeof errorPayload === "object" && "code" in errorPayload
              ? (errorPayload as ApiResponse).code
              : undefined;

          const err = new AlovaRequestError(
            resolveErrorMessage(
              errorPayload,
              `${response.status} ${response.statusText}`,
              response.status,
              bodyCode,
            ),
            {
              data: errorPayload,
              status: response.status,
              statusText: response.statusText,
              code: bodyCode ?? response.status,
            },
          );
          await reportRequestError(err);
          throw err;
        }
        const contentType = response.headers.get("content-type") ?? "";
        let payload: any;
        if (contentType.includes("application/json")) {
          payload = await response.json();
        } else {
          const text = await response.clone().text();
          try {
            payload = JSON.parse(text);
          } catch {
            payload = text;
          }
        }

        const bodyCode: number | undefined =
          payload && typeof payload === "object" && "code" in payload
            ? (payload as ApiResponse).code
            : undefined;

        // ==================== 401 无感刷新 ====================
        const isRefreshEndpoint = method.url.includes("/auth/refresh");
        const alreadyRetried = (method as any)._retried === true;

        if (
          isUnauthorized(response.status, bodyCode) &&
          !isAuthEndpoint(method.url) && // ← 关键：auth 接口本身不刷新
          !alreadyRetried &&
          !isLoggingOut // ← 正在登出，别再折腾
        ) {
          (method as any)._retried = true;
          try {
            await getRefreshPromise();
            return await method.send();
          } catch {
            forceLogout();
            const err = new AlovaRequestError("登录已过期", {
              status: 401,
              statusText: "Unauthorized",
              code: ErrorCode.UNAUTHORIZED,
            });
            err.handled = true;
            throw err;
          }
        }

        // ==================== HTTP 层失败 ====================
        if (!response.ok) {
          const err = new AlovaRequestError(
            resolveErrorMessage(
              payload,
              `${response.status} ${response.statusText}`,
              response.status,
              bodyCode,
            ),
            {
              data: payload,
              status: response.status,
              statusText: response.statusText,
              code: bodyCode ?? response.status, // ← 没业务码时用 HTTP status 兜
            },
          );
          await reportRequestError(err);
          throw err;
        }

        // ==================== 业务层失败（HTTP 200 但 code !== 200）====================
        if (bodyCode !== undefined && bodyCode !== ErrorCode.SUCCESS) {
          const err = new AlovaRequestError(
            resolveErrorMessage(payload, "请求失败", response.status, bodyCode),
            {
              data: payload,
              status: response.status,
              statusText: response.statusText,
              code: bodyCode,
            },
          );
          await reportRequestError(err);
          throw err;
        }

        // ==================== 成功 ====================
        // 按后端规范：成功响应 `{ code: 200, data, message?, timestamp? }`
        return payload;
      },

      async onError(error, method) {
        clearPendingRequest(method, error);

        // 刷新失败等已处理过的错误，不再重复提示 / 重试
        if (error instanceof AlovaRequestError && error.handled) {
          throw error;
        }

        const shouldRetry = getRetryConfig(error, method, maxRetries);
        if (shouldRetry.shouldRetry) {
          console.warn(
            `[API] 请求失败，正在重试 (${shouldRetry.currentAttempt}/${maxRetries})...`,
            method.url,
          );
          await delay(calculateBackoff(shouldRetry.currentAttempt));
          try {
            return await method.send();
          } catch (retryError) {
            await reportRequestError(retryError);
            throw retryError;
          }
        }

        await reportRequestError(error);
        throw error;
      },
    },
  });
}

// ==================== 辅助函数 ====================
function getRequestKey(method: any): string {
  return [
    method.type,
    method.url,
    JSON.stringify(method.params ?? {}),
    JSON.stringify(method.data ?? {}),
  ].join(":");
}

function clearPendingRequest(method: any, error: unknown): void {
  if (error instanceof AlovaRequestError && error.handled) throw error;
  if (isLoggingOut) throw error;
  const requestKey = getRequestKey(method);
  pendingRequests.delete(requestKey);
}

function calculateBackoff(attempt: number, baseDelay = 300): number {
  const exponentialDelay = baseDelay * 2 ** attempt;
  const jitter = Math.random() * 200;
  return Math.min(exponentialDelay + jitter, 10000);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryConfig(
  error: any,
  _method: any,
  maxRetries: number,
): { shouldRetry: boolean; currentAttempt: number } {
  const currentAttempt = error instanceof AlovaRequestError ? error.retryCount + 1 : 1;
  if (currentAttempt > maxRetries) return { shouldRetry: false, currentAttempt };

  if (error instanceof AlovaRequestError) {
    // 业务错误不重试
    if (
      error.code === ErrorCode.VALIDATION_FAILED ||
      error.code === ErrorCode.UNAUTHORIZED ||
      error.code === ErrorCode.FORBIDDEN ||
      error.code === ErrorCode.NOT_FOUND
    ) {
      return { shouldRetry: false, currentAttempt };
    }

    // 5xx 全部可重试
    if (isRetryable(error)) return { shouldRetry: true, currentAttempt };

    // status === 0：网络中断
    if (error.status === 0) return { shouldRetry: true, currentAttempt };
  }

  if (error instanceof TypeError) return { shouldRetry: true, currentAttempt };
  return { shouldRetry: false, currentAttempt };
}

async function reportRequestError(error: unknown) {
  if (error instanceof AlovaRequestError) {
    if (error.handled) return;
    if (SILENT_ERROR_CODES.has(error.code)) return;

    // 5xx：统一友好文案（包括 500/501/502/503/504 和业务码 5xxxxx）
    if (isServerFailure(error.status, error.code)) {
      notification.error({ title: "请求错误", description: error.message || SERVER_ERROR_MESSAGE });
      return;
    }

    notification.error({
      title: "请求错误",
      description: resolveErrorMessage(error.data, error.message, error.status, error.code),
    });
    return;
  }

  if (error instanceof Error) {
    // 网络层异常（fetch 抛 TypeError / AbortError）
    if (error.name === "AbortError") return; // 用户取消，不提  示
    if (error.name === "TimeoutError") {
      notification.error({ title: "请求错误", description: "请求超时，请检查网络" });
      return;
    }
    notification.error({ title: "请求错误", description: error.message || SERVER_ERROR_MESSAGE });
    return;
  }
  notification.error({ title: "请求错误", description: SERVER_ERROR_MESSAGE });
}

function resolveErrorMessage(
  data: unknown,
  fallback: string,
  status?: number,
  code?: number,
): string {
  // 5xx：不把内部错误信息透给用户，统一文案
  if (isServerFailure(status ?? 0, code)) {
    return data.message || SERVER_ERROR_MESSAGE;
  }
  if (typeof data === "object" && data !== null) {
    if ("message" in data && typeof (data as any).message === "string") {
      return (data as any).message;
    }
    if ("msg" in data && typeof (data as any).msg === "string") {
      return (data as any).msg;
    }
  }
  return fallback;
}

export const http = createRequestClient();
export type { RequestMeta };
export { AlovaRequestError as RequestError };
