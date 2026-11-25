/**
 * 标准化业务错误模型
 *
 * 响应体依旧是 `{ code, data: null, message }`（与真实后端 R<T> 一致），
 * 但服务端内部用 ApiError 携带字段级明细：明细进入审计日志与请求上下文，
 * message 面向调用方给出可直接展示的中文描述。这样既不破坏前端契约，
 * 又保留了定位问题所需的结构化信息。
 */

import type { ApiEnvelope } from '@antdv/types';

import { ApiCode, messageOfCode } from './codes';

/** 字段级错误明细，用于审计与联调定位；不会直接写进响应体 */
export interface ApiErrorItem {
  /** 字段路径，如 `body.password` / `query.pageNum` */
  field: string;
  /** 字段级校验描述 */
  message: string;
  /** 机器可读的子码，如 `too_small` / `invalid_type` */
  code?: string;
}

export interface ApiErrorOptions {
  /** 原始异常，用于服务端日志追溯 */
  cause?: unknown;
  /** 是否同步抬升 HTTP 状态（仅运行时拦截使用，业务错误默认不抬升） */
  httpStatus?: number;
}

export class ApiError extends Error {
  readonly code: number;
  readonly items: readonly ApiErrorItem[];
  readonly httpStatus?: number;

  constructor(
    code: number,
    message: string,
    items: readonly ApiErrorItem[] = [],
    options: ApiErrorOptions = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'ApiError';
    this.code = code;
    this.items = items;
    this.httpStatus = options.httpStatus;
  }

  /** 转成对外的标准错误信封（固定三字段，data 恒为 null） */
  toEnvelope(): ApiEnvelope<null> {
    return { code: this.code, data: null, message: this.message };
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

export function badRequest(
  message = messageOfCode(ApiCode.BAD_REQUEST),
  items: readonly ApiErrorItem[] = [],
): ApiError {
  return new ApiError(ApiCode.BAD_REQUEST, message, items);
}

export function unauthorized(message = messageOfCode(ApiCode.UNAUTHORIZED)): ApiError {
  return new ApiError(ApiCode.UNAUTHORIZED, message);
}

export function forbidden(message = messageOfCode(ApiCode.FORBIDDEN)): ApiError {
  return new ApiError(ApiCode.FORBIDDEN, message);
}

export function notFound(resource = '资源'): ApiError {
  return new ApiError(ApiCode.NOT_FOUND, `${resource}不存在`);
}

export function conflict(message: string): ApiError {
  return new ApiError(ApiCode.CONFLICT, message);
}

export function internalError(
  message = messageOfCode(ApiCode.INTERNAL_ERROR),
  cause?: unknown,
): ApiError {
  return new ApiError(ApiCode.INTERNAL_ERROR, message, [], { cause });
}

/** 把未知异常规整成 ApiError：已知错误原样透传，未知一律 500 且隐藏内部细节 */
export function normalizeError(error: unknown): ApiError {
  if (isApiError(error)) return error;
  const message = error instanceof Error ? error.message : String(error);
  return internalError('服务器内部错误', message);
}
