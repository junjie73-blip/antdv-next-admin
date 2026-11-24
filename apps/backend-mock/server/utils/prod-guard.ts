/**
 * 生产环境保护：禁用「重置 / 运行时控制面」写接口。
 *
 * 生产环境的数据只能来自接口真实读写或显式运维初始化，不允许通过
 * Mock 数据中心面板做延迟注入 / 失败注入 / 停用接口 / 清空日志 / 重置配置，
 * 这些能力仅服务于开发环境验收。
 *
 * 与 `server/middleware/prod-guard.ts` 配套：中间件按 method + path 拦截，
 * 本模块导出纯函数便于单测，不依赖 Nitro 运行时。
 */

import type { ApiEnvelope } from '@antdv/types';

import { isProduction } from './db/sqlite/env';
import { bizError } from './response';

/** 键形如 `${METHOD} ${path}`，path 与 server/api 下的路由一致（含 /api 前缀） */
export const PROD_BLOCKED_OPS = new Set<string>([
  'POST /api/mock-center/logs/clear',
  'POST /api/mock-center/route-runtime',
  'POST /api/mock-center/routes/remove',
  'POST /api/mock-center/routes/save',
  'POST /api/mock-center/runtime',
  'PUT /api/system/config/reset',
]);

export function isProdBlockedOp(method: string, path: string): boolean {
  return PROD_BLOCKED_OPS.has(`${method.toUpperCase()} ${path}`);
}

/** 命中返回 403 业务信封，否则返回 null（放行） */
export function guardProdOp(
  method: string,
  path: string,
): ApiEnvelope<null> | null {
  if (!isProduction()) return null;
  if (!isProdBlockedOp(method, path)) return null;
  return bizError(403, '生产环境已禁用该运维接口');
}
