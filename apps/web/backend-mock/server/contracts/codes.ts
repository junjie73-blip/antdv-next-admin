/**
 * 统一状态码 / 业务码目录（真值源）
 *
 * 本服务沿用后端 `R<T>` 的约定：响应体恒为 `{ code, data, message }` 三个字段，
 * `code` 与常见 HTTP 状态码同值，业务失败时 HTTP 状态仍为 200（由前端 request 层按 code 判定）。
 * 运行时拦截（停服 / 失败注入）例外：HTTP 状态与 code 同步抬升，便于代理与监控识别。
 *
 * 新增状态码必须同时登记到 CODE_CATALOG 与 CODE_MESSAGE，并由 openapi 生成器输出到文档，
 * 禁止在 handler 里写裸数字。
 */

export const ApiCode = {
  /** 请求成功 */
  OK: 200,
  /** 请求参数不合法（含字段级校验失败） */
  BAD_REQUEST: 400,
  /** 未登录或凭据失效（真实后端启用鉴权后使用） */
  UNAUTHORIZED: 401,
  /** 已登录但无操作权限 */
  FORBIDDEN: 403,
  /** 资源不存在 */
  NOT_FOUND: 404,
  /** 请求方法不被允许 */
  METHOD_NOT_ALLOWED: 405,
  /** 资源冲突（唯一约束 / 状态冲突） */
  CONFLICT: 409,
  /** 语义错误但格式正确 */
  UNPROCESSABLE_ENTITY: 422,
  /** 请求过于频繁 */
  TOO_MANY_REQUESTS: 429,
  /** 服务端内部错误 */
  INTERNAL_ERROR: 500,
  /** 服务不可用（全局停用 / 熔断） */
  SERVICE_UNAVAILABLE: 503,
} as const;

export type ApiCodeValue = (typeof ApiCode)[keyof typeof ApiCode];

/** 码段划分：与真实后端错误码分段保持一致，便于日志检索与告警分组 */
export const CODE_SEGMENTS = {
  '2xx': '成功',
  '4xx': '客户端错误（参数 / 鉴权 / 资源）',
  '5xx': '服务端错误（内部异常 / 不可用）',
} as const;

export type CodeCategory = keyof typeof CODE_SEGMENTS;

export interface CodeDescriptor {
  /** 业务码，同时是响应体的 code 字段 */
  code: ApiCodeValue;
  /** 默认文案，handler 可覆盖为更具体的场景文案 */
  message: string;
  /** 所属码段 */
  category: CodeCategory;
  /** 是否属于成功响应 */
  success: boolean;
  /** 该码在真实后端是否会同步抬升 HTTP 状态（mock 运行时按此决定是否改 status） */
  httpStatus: number;
}

/** 全量码表：OpenAPI 与 API 文档的错误码章节由这里生成 */
export const CODE_CATALOG: readonly CodeDescriptor[] = [
  { code: 200, message: 'ok', category: '2xx', success: true, httpStatus: 200 },
  { code: 400, message: '请求参数错误', category: '4xx', success: false, httpStatus: 200 },
  { code: 401, message: '未登录或登录已过期', category: '4xx', success: false, httpStatus: 200 },
  { code: 403, message: '没有操作权限', category: '4xx', success: false, httpStatus: 200 },
  { code: 404, message: '请求的资源不存在', category: '4xx', success: false, httpStatus: 200 },
  { code: 405, message: '请求方法不被允许', category: '4xx', success: false, httpStatus: 200 },
  { code: 409, message: '资源状态冲突', category: '4xx', success: false, httpStatus: 200 },
  { code: 422, message: '请求语义错误', category: '4xx', success: false, httpStatus: 200 },
  { code: 429, message: '请求过于频繁', category: '4xx', success: false, httpStatus: 200 },
  { code: 500, message: '服务器内部错误', category: '5xx', success: false, httpStatus: 200 },
  { code: 503, message: '服务暂不可用', category: '5xx', success: false, httpStatus: 200 },
];

const messages = new Map<number, string>(
  CODE_CATALOG.map((item) => [item.code, item.message]),
);

export function isSuccessCode(code: number): boolean {
  return code === ApiCode.OK;
}

/** 取码的默认文案；未登记的业务码返回兜底文案，避免 undefined 泄漏到响应体 */
export function messageOfCode(code: number, fallback = '请求失败'): string {
  return messages.get(code) ?? fallback;
}

export function descriptorOfCode(code: number): CodeDescriptor | undefined {
  return CODE_CATALOG.find((item) => item.code === code);
}
