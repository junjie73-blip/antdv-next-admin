import type { ExecuteOptions } from '~/composables';

import { useApiHealthStore } from '@antdv/stores';

import { http } from '~/composables';

export interface R<T = unknown> {
  code: number;
  data: T;
  message: string;
}

export interface RL<T = unknown> {
  code: number;
  data: {
    list: T[];
    total: number;
  };
  message: string;
}

/**
 * 业务失败异常。
 *
 * 后端约定 HTTP 恒为 200、成败放在信封的 `code` 上；以前 `get/post/put/del`
 * 直接 `.data` 把 `code` 丢掉了，于是 `code=400` 也会走「操作成功」分支。
 * 现在统一在这里抛错，页面 catch 里的 `message.error(error.message)` 才能给出真实反馈。
 */
export class ApiBusinessError extends Error {
  readonly code: number;
  readonly payload: unknown;

  constructor(code: number, message: string, payload: unknown) {
    super(message);
    this.name = 'ApiBusinessError';
    this.code = code;
    this.payload = payload;
  }
}

/** 校验业务码并解出 data；非信封响应（blob / text / 裸数据）原样透传 */
function unwrap<T>(envelope: R<T>): T {
  if (
    !envelope ||
    typeof envelope !== 'object' ||
    !('code' in envelope) ||
    typeof envelope.code !== 'number'
  ) {
    return envelope as unknown as T;
  }
  if (envelope.code !== 200) {
    const message =
      envelope.message || `请求失败（业务码 ${envelope.code}）`;
    // 第二个错误出口：非 JSON 信封或绕过 fetcher 的调用也会到这里。
    // 单测 / SSR 没有 active pinia 时静默，请求层的 onError 已经上报过一次。
    try {
      useApiHealthStore().markError(message);
    } catch {
      /* no pinia: ignore */
    }
    throw new ApiBusinessError(envelope.code, message, envelope.data);
  }
  return envelope.data;
}

export function get<T = unknown>(
  url: string,
  params?: Record<string, unknown>,
  opts?: ExecuteOptions,
) {
  // 第二个实参**就是查询串本身**，不要再包一层 `{ params }`：
  // 包了之后 `buildUrl` 看到的是"一个叫 params 的参数"，
  // 于是发出去的是 `?params=[object Object]`，筛选与分页条件整批丢失
  // （表现是"搜索框输什么都一样、翻到第二页还是第一页的数据"）。
  return http.Get<R<T>>(url, params, opts).then(unwrap);
}

export function post<T = unknown>(
  url: string,
  data?: Record<string, unknown>,
  params?: Record<string, unknown>,
) {
  return http
    .Post<R<T>>(url, data, params ? { params } : undefined)
    .then(unwrap);
}

export function put<T = unknown>(
  url: string,
  data?: Record<string, unknown>,
  params?: Record<string, unknown>,
) {
  return http
    .Put<R<T>>(url, data, params ? { params } : undefined)
    .then(unwrap);
}

export function del<T = unknown>(
  url: string,
  params?: Record<string, unknown>,
) {
  return http.Delete<R<T>>(url, params).then(unwrap);
}
