/**
 * 统一参数校验（zod）
 *
 * 目标：所有 handler 用同一套 schema 描述入参，校验失败统一返回 HTTP 200 + code 400，
 * message 里带出字段路径，字段级明细写入 ApiError.items 供审计与联调定位。
 *
 * 分页参数同时兼容 `pageNum`（前端 BasicTable 默认）与遗留的 `page`；
 * query 里同名多值在这里拍平成第一个值，避免 `z.coerce.number()` 直接收到数组。
 */

import { z } from 'zod';

import { ApiCode } from './codes';
import { ApiError, type ApiErrorItem } from './errors';

export type ParamSource = 'body' | 'params' | 'query';

/** query 值拍平：同名多值取第一个；undefined / 空串保留给 schema 决定 */
export function flattenQuery(
  query: Record<string, string | string[] | undefined>,
): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(query).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
}

function fieldPath(prefix: ParamSource, path: readonly (string | number)[]): string {
  return path.length === 0 ? prefix : `${prefix}.${path.join('.')}`;
}

/** zod 失败 → 标准 400 错误，字段明细不泄漏到响应体但保留在异常对象上 */
export function validationError(error: z.ZodError, source: ParamSource): ApiError {
  const items: ApiErrorItem[] = error.issues.map((issue: z.ZodIssue) => ({
    field: fieldPath(source, issue.path),
    message: issue.message,
    code: issue.code,
  }));
  const detail = items
    .map((item) => `${item.field} ${item.message}`)
    .join('；');
  return new ApiError(
    ApiCode.BAD_REQUEST,
    detail ? `参数校验失败：${detail}` : '请求参数错误',
    items,
    { cause: error },
  );
}

/** 校验并抛出 ApiError；成功时返回 zod 解析后的强类型值 */
export function validate<T extends z.ZodTypeAny>(
  schema: T,
  value: unknown,
  source: ParamSource = 'body',
): z.output<T> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw validationError(result.error, source);
}

/* ------------------------------------------------------------------ */
/* 可复用字段 schema（文案即错误提示，禁止调用方再手写等价校验）            */
/* ------------------------------------------------------------------ */

export const requiredString = (label: string, max = 128): z.ZodString =>
  z
    .string({ required_error: `${label}不能为空`, invalid_type_error: `${label}必须是字符串` })
    .trim()
    .min(1, `${label}不能为空`)
    .max(max, `${label}长度不能超过 ${max} 个字符`);

export const optionalString = (label: string, max = 256): z.ZodOptional<z.ZodString> =>
  z
    .string({ invalid_type_error: `${label}必须是字符串` })
    .trim()
    .max(max, `${label}长度不能超过 ${max} 个字符`)
    .optional();

export const positiveInt = (label: string): z.ZodNumber =>
  z.coerce
    .number({ invalid_type_error: `${label}必须是数字`, required_error: `${label}不能为空` })
    .int(`${label}必须是整数`)
    .positive(`${label}必须大于 0`);

/** 业务 id：真实后端是自增数字，历史数据也可能是 cuid 字符串，两种都收 */
export const bizIdSchema = z.union([
  positiveInt('id'),
  z.string().trim().min(1, 'id 不能为空').max(64, 'id 过长'),
]);

export const statusFlagSchema = z.coerce
  .number({ invalid_type_error: '状态必须是数字' })
  .int('状态必须是整数')
  .refine((value) => value === 0 || value === 1, '状态只能是 0（停用）或 1（启用）');

export const pageQuerySchema = z
  .object({
    pageNum: z.coerce
      .number({ invalid_type_error: 'pageNum 必须是数字' })
      .int('pageNum 必须是整数')
      .min(1, 'pageNum 必须大于 0')
      .max(100000, 'pageNum 超出上限')
      .optional()
      .default(1),
    page: z.coerce
      .number({ invalid_type_error: 'page 必须是数字' })
      .int('page 必须是整数')
      .min(1, 'page 必须大于 0')
      .optional(),
    pageSize: z.coerce
      .number({ invalid_type_error: 'pageSize 必须是数字' })
      .int('pageSize 必须是整数')
      .min(1, 'pageSize 必须大于 0')
      .max(200, 'pageSize 不能超过 200')
      .optional()
      .default(10),
  })
  /** 筛选字段（status / keyword / 时间范围等）交给各业务 schema 补充，这里原样透传 */
  .passthrough();

export type PageQuery = Pick<z.output<typeof pageQuerySchema>, 'pageNum' | 'pageSize'>;

/** 从任意 query 取标准化分页参数：pageNum 优先，其次兼容遗留 page */
export function pageOf(query: Record<string, string | string[] | undefined>): PageQuery {
  const parsed = validate(pageQuerySchema, flattenQuery(query), 'query');
  return { pageNum: parsed.page ?? parsed.pageNum, pageSize: parsed.pageSize };
}

export const dateRangeSchema = z
  .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD'))
  .length(2, '时间范围需要起止两个日期');

export const booleanLikeSchema = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((value) => value === true || value === 'true' || value === '1');
