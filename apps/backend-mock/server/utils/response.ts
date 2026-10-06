/**
 * 统一响应信封
 *
 * 与后端 R<T> 契约保持一致（`@antdv/types` 的 ApiEnvelope），
 * 前端 request.ts 依据 `code` 字段判定业务成败，因此所有 mock 响应都必须走这里。
 */

import type { ApiEnvelope } from '@antdv/types';

export function envelope<T>(
  code: number,
  data: T,
  message: string,
): ApiEnvelope<T> {
  return { code, data, message };
}

/** 业务成功（HTTP 200 + code 200） */
export function success<T>(data: T, message = 'ok'): ApiEnvelope<T> {
  return envelope(200, data, message);
}

/**
 * 业务失败：HTTP 状态仍是 200，仅信封 code 非 200，
 * 与 legacy mock 的行为一致（如登录密码错误返回 code 400）。
 */
export function bizError(code: number, message: string): ApiEnvelope<null> {
  return envelope(code, null, message);
}

/** 运行时拦截（全局停用 / 单接口停用 / 失败注入）产生的错误：HTTP 状态码与 code 同值 */
export function httpError(status: number, message: string): ApiEnvelope<null> {
  return envelope(status, null, message);
}
