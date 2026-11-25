/**
 * 操作日志构造器
 *
 * 把一次请求的上下文规整成真实后端 `tb_operation_log` 的字段集合：
 * 谁、在什么时间、对什么对象、做了什么、从哪来、结果如何、耗时多少、链路号是多少。
 * 运行时用它生成审计 detail；handler 也可用它写更细粒度的业务操作日志。
 */

import type { MockRouteInput } from '../utils/runtime';

import { isSuccessCode } from './codes';
import type { OperationLog } from './models';

export interface BuildOperationLogInput {
  context: MockRouteInput;
  detail: string;
  durationMs: number;
  method: string;
  module: string;
  path: string;
  startedAt: Date;
  endedAt?: Date;
  /** 业务失败码；不传则按 200 处理 */
  code?: number;
  /** 显式的失败原因（优先于 code 推导） */
  errorMessage?: string;
}

/** 从路由路径推断业务对象类型与 id：`/system/user/12` → { bizType: 'user', bizId: '12' } */
export function bizTargetOf(path: string): { bizId?: string; bizType: string } {
  const segments = path.split('/').filter(Boolean);
  const last = segments.at(-1);
  const isId = Boolean(last && /^\d+$|^[a-f0-9]{20,}$/i.test(last));
  const bizType = isId ? (segments.at(-2) ?? 'resource') : (last ?? 'resource');
  return isId && last ? { bizId: last, bizType } : { bizType };
}

function riskOf(path: string, failed: boolean): OperationLog['risk'] {
  if (failed) return 'high';
  if (/\/security|\/ai\/|\/auth\//.test(path)) return 'medium';
  return 'low';
}

export function buildOperationLog(input: BuildOperationLogInput): OperationLog {
  const {
    code = 200,
    context,
    detail,
    durationMs,
    endedAt = new Date(),
    errorMessage,
    method,
    module,
    path,
    startedAt,
  } = input;
  const failed = !isSuccessCode(code);
  const target = bizTargetOf(path);
  const message = errorMessage ?? (failed ? `业务码 ${code}` : undefined);

  return {
    action: `${method} ${path}`,
    actor: context.headers.authorization ? 'authenticated' : 'anonymous',
    bizId: target.bizId,
    bizType: target.bizType,
    detail,
    durationMs,
    endTime: endedAt.toISOString(),
    ip: context.clientIp ?? 'unknown',
    method,
    module,
    path,
    result: failed ? 'error' : 'success',
    risk: riskOf(path, failed),
    startTime: startedAt.toISOString(),
    ...(message ? { errorMessage: message } : {}),
    traceId: context.traceId ?? 'unknown',
  };
}
