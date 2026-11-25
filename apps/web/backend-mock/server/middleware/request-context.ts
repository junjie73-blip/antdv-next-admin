/**
 * 请求上下文中间件
 *
 * 每个请求进来先分配 / 透传链路号，写入 event.context.traceId 与响应头。
 * 业务 handler 与审计层统一从这里取 traceId，前端报错时拿着 x-request-id
 * 就能在审计台账里定位同一条请求 —— 这是真实服务排障链路的第一步。
 */

import { randomUUID } from 'node:crypto';

import { defineMiddleware } from 'nitro';
import { getRequestHeader, setResponseHeader } from 'nitro/h3';

export default defineMiddleware(async (event, next) => {
  const traceId =
    getRequestHeader(event, 'x-request-id') ??
    getRequestHeader(event, 'x-trace-id') ??
    randomUUID();

  Object.assign(event.context, { traceId, startedAt: new Date() });
  setResponseHeader(event, 'x-request-id', traceId);
  setResponseHeader(event, 'x-trace-id', traceId);

  return next();
});
