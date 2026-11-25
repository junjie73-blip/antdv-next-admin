/**
 * Mock 运行时层（defineMockRoute）—— legacy mock/_runtime.ts 的 Nitro 移植
 *
 * 职责保持不变：全局开关 / 单接口延迟 / 停用 / 失败注入 / 命中统计与日志，
 * 并把每条接口登记进 store 供「Mock 数据中心」面板展示与编辑。
 *
 * 与 legacy 的关键差异：
 * - fake-server 的 path-to-regexp 按注册顺序取首个命中，所以 withRuntime 需要
 *   「无参数路径优先」重排；Nitro 用 radix 树路由，静态段天然优先于 `:param`，不再需要重排。
 * - 运行时管道（executeWithRuntime）与 h3 事件适配（defineMockRoute）分离：
 *   纯逻辑部分不依赖 Nitro，可直接被 Vitest 覆盖，generated 中间件也复用同一管道。
 */

import type { MockMethod } from '@antdv/types';
import type { H3Event } from 'nitro/h3';

import type { RouteManifestItem } from './store';

import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

// Nitro v3：自动导入 / #imports 已移除，全部改为显式导入（nitro/h3 保留 h3 v1 工具函数）
import { defineHandler } from 'nitro';
import {
  getQuery,
  readBody,
  setResponseHeader,
  setResponseStatus,
} from 'nitro/h3';

import { messageOfCode } from '../contracts/codes';
import { normalizeError, type ApiError } from '../contracts/errors';
import { buildOperationLog } from '../contracts/operation-log';
import type { RouteOverride } from '../contracts/runtime-kv';

import { resolveAccount } from './accounts';
import { maskPolicySnapshot, recordAudit } from './db/security-advanced';
import { getGlobalConfig, getRouteOverride } from './kv/mock-kv';
import { envelope, httpError, success } from './response';
import { keyOf, methodOf, moduleOf, shouldInjectFailure } from './route-meta';
import { sanitizePayload, stringifyPayload } from './security/masking';
import { pushLog, recordHit, registerManifest, resolveRuntime } from './store';

/**
 * 处理器入参：与 legacy MockContext 对齐的便捷视图。
 * - `data`：已解析的请求体，无 body 时是空对象
 * - `params`：路由参数（`:id` 捕获值）
 * - `path`：注册时的路径，不含查询串，也不含 /api 前缀
 *
 * `headers` 键名按 Node 入站头的约定是**小写**（同名多值用逗号并成字符串）。
 * 按会话分数据的接口（`/menus`、`/auth/user-info`）要从 `authorization` 里认 token，
 * 所以这里必须透传真实请求头 —— legacy 时代没有 handler 消费它，字段才恒为空对象。
 */
export interface MockRouteInput {
  body: Record<string, unknown>;
  data: Record<string, unknown>;
  headers: Record<string, string>;
  params: Record<string, string>;
  path: string;
  /** 原始查询参数：同名多值是数组（login-log 的 dateRange 依赖该语义），与 legacy 一致不做拍平 */
  query: Record<string, string | string[] | undefined>;
  /** 安全审计上下文：由 H3 事件解析，直接调用 handler 的单测可缺省 */
  clientIp?: string;
  traceId?: string;
  userAgent?: string;
}

export type MockHandler = (
  context: MockRouteInput,
) => Promise<unknown> | unknown;

export interface MockRouteDefinition {
  handler: MockHandler;
  /** 分组覆盖：同一 method + path 历史上由多个文件注册时，用它保留归属信息 */
  module?: string;
  method: MockMethod;
  path: string;
  /** 展示名，仅面板需要 */
  title?: string;
}

/** 运行时管道的产出：body 是最终响应（通常是信封），status 非空时覆盖 HTTP 状态码 */
export interface MockOutcome {
  body: unknown;
  status?: number;
}

/** getQuery / router params 的值可能是数组（同名多值），legacy 用 join 归一为字符串 */
export function normalizeValues(
  record: Record<string, string | string[] | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).map(([name, value]) => [
      name,
      Array.isArray(value) ? value.join(',') : (value ?? ''),
    ]),
  );
}

/**
 * 纯运行时管道：全局开关 → 单接口停用 → 延迟 → 失败注入 → 业务处理 → 统计与日志。
 * 与 legacy toFakeRoute 的响应包装逐行对齐（含 skipped / injected / code 归因语义）。
 */
export async function executeWithRuntime(
  route: { key: string; method: MockMethod; module: string; path: string },
  run: MockHandler,
  context: MockRouteInput,
  random: () => number = Math.random,
): Promise<MockOutcome> {
  const { key, method, module, path } = route;
  const startedAt = performance.now();
  const runtime = resolveRuntime(key);
  let status = 200;
  let code = 200;
  let skipped = false;
  // 不给 `= null` 初值：每条 return 前都会赋值，占位初值反而掩盖「忘了赋值」
  let body: unknown;

  try {
    if (!runtime.globalEnabled) {
      skipped = true;
      status = 503;
      body = envelope(
        status,
        null,
        'Mock 服务已全局停用，请在 Mock 数据中心恢复',
      );
      return { body, status };
    }
    if (runtime.disabled) {
      skipped = true;
      status = 404;
      body = envelope(status, null, `Mock 接口已停用：${key}`);
      return { body, status };
    }

    if (runtime.delay > 0) await sleep(runtime.delay);

    if (shouldInjectFailure(runtime.failRate, random)) {
      status = runtime.forcedStatus ?? 500;
      code = status;
      body = envelope(
        status,
        null,
        `Mock 已按 ${runtime.failRate}% 失败率注入错误响应`,
      );
      return { body, status };
    }

    let result: unknown;
    try {
      result = await run(context);
    } catch (error) {
      // 校验失败 / 权限不足 / 未知异常都在这里收口，保证任何路径都返回标准信封
      const apiError = normalizeError(error);
      code = apiError.code;
      status = apiError.httpStatus ?? 200;
      body = apiError.toEnvelope();
      Object.assign(context, { apiError });
      return { body, status };
    }
    if (isEnvelopeLike(result)) code = result.code;
    body = result;
    return { body };
  } finally {
    const ms = Math.max(1, Math.round(performance.now() - startedAt));
    recordHit(key, ms, status);
    pushLog({
      code,
      injected: !skipped && status >= 400,
      key,
      method,
      module,
      ms,
      path,
      skipped,
      status,
    });
  }
}

/** 审计台账的噪声端点：读审计自身会产生无限递归式的无意义记录 */
const AUDIT_EXEMPT_PATHS = [
  '/security/audit/list',
  '/security/ai-calls/list',
  '/mock/',
];

/**
 * 统一审计落点：所有经 defineMockRoute 的请求都在这里生成一条
 * actor / action / target / ip / result / traceId 记录。
 * 请求体先过服务端脱敏策略，凭据字段无条件打码。
 */
function recordApiAudit(
  route: { method: MockMethod; module: string; path: string },
  context: MockRouteInput,
  outcome: MockOutcome,
  startedAt: Date,
  durationMs: number,
): void {
  const path = route.path;
  if (AUDIT_EXEMPT_PATHS.some((item) => path.includes(item))) return;

  const body = isEnvelopeLike(outcome.body)
    ? (outcome.body as { code: number })
    : null;
  const code = body?.code ?? outcome.status ?? 200;
  const apiError = (context as MockRouteInput & { apiError?: ApiError }).apiError;
  const detailPayload =
    route.method === 'GET'
      ? { query: context.query, params: context.params }
      : { body: context.body, query: context.query, params: context.params };
  const requestDetail = stringifyPayload(
    sanitizePayload(detailPayload, maskPolicySnapshot()),
  ).slice(0, 620);
  // 标准操作日志字段与脱敏后的请求参数一起进入审计 detail，
  // 保持 detail 仍为字符串（不破坏审计台账契约），前端可直接展示或按 JSON 解析首段。
  const operation = buildOperationLog({
    code,
    context,
    detail: requestDetail,
    durationMs,
    endedAt: new Date(),
    errorMessage: apiError?.message,
    method: route.method,
    module: route.module,
    path,
    startedAt,
  });
  const detail = `${JSON.stringify({
    action: operation.action,
    bizId: operation.bizId,
    bizType: operation.bizType,
    durationMs: operation.durationMs,
    endTime: operation.endTime,
    result: operation.result,
    startTime: operation.startTime,
    ...(operation.errorMessage ? { errorMessage: operation.errorMessage } : {}),
  })} | ${requestDetail}`.slice(0, 800);

  recordAudit({
    action: operation.action,
    actor: resolveAccount(context.headers).profile.username,
    detail,
    ip: operation.ip,
    method: route.method,
    path,
    result: operation.result,
    risk: operation.risk,
    traceId: operation.traceId,
  });
}

/**
 * 读取 KV 动态覆盖并生成实际执行函数。
 *
 * 优先级：KV 覆盖 > 原 handler。KV 不可用时静默回落原 handler —— KV 是增强能力，
 * 不能因为存储故障把整个 mock 服务打挂。停用/失败码/返回值/延迟都在这里生效，
 * 下一次请求就能看到改动，无需重启。
 */
export async function resolveKvHandler(
  key: string,
  original: MockHandler,
): Promise<MockHandler> {
  let override: RouteOverride | null = null;
  try {
    if (!(await getGlobalConfig()).overridesEnabled)
      return original;
    override = await getRouteOverride(key);
  } catch {
    return original;
  }
  if (!override) return original;

  return async (context: MockRouteInput) => {
    if (override?.delayMs) await sleep(override.delayMs);
    if (override.enabled === false)
      return httpError(503, `Mock 接口已被 KV 配置停用：${key}`);
    if (
      override.statusCode !== undefined &&
      override.statusCode !== 200
    )
      return httpError(
        override.statusCode,
        messageOfCode(override.statusCode, 'Mock 已按 KV 配置注入错误响应'),
      );
    if (override.response !== undefined) return success(override.response);
    return original(context);
  };
}

/**
 * 业务接口注册入口：模块加载即登记清单（配合 server/utils/registry.ts 的启动预注册，
 * 面板在任何请求发生前就能拿到全量列表），返回值直接作为 Nitro route file 的 default export。
 */
export function defineMockRoute(definition: MockRouteDefinition) {
  const method = methodOf(definition.method);
  const key = keyOf(method, definition.path);
  const route: RouteManifestItem = {
    duplicates: [],
    key,
    method,
    module: definition.module ?? moduleOf(definition.path),
    path: definition.path,
    source: 'source',
    ...(definition.title ? { title: definition.title } : {}),
  };
  registerManifest([route]);

  return defineHandler(async (event: H3Event) => {
    const startedAt = new Date();
    const context = await toRouteInput(event, definition.path);
    // executeWithRuntime 只需要 key/method/module/path 四个字段做统计与日志；
    // route 是清单条目（RouteManifestItem），其 method 按共享契约被放宽成 string，
    // 这里回填本地窄化的 method（methodOf 保证是 MockMethod），避免把宽类型带进管道
    const outcome = await executeWithRuntime(
      { ...route, method },
      await resolveKvHandler(key, definition.handler),
      context,
    );
    const durationMs = Math.max(0, Date.now() - startedAt.getTime());
    /**
     * 一律禁缓存，两条都是这服务自己的性质决定的：
     * ① 写接口改的是进程内内存，列表必须立刻反映改动；
     * ② 按会话分数据的接口（`/menus`、`/auth/user-info`）**同一个 URL 会因
     *    `Authorization` 不同给出不同内容**。没有 `Vary` 时浏览器有权把上一个人的
     *    响应直接发给下一个人 —— 实测表现是"用权限更小的账号登录，却拿到全量菜单"，
     *    看着像裁剪逻辑坏了，其实是命中了缓存。
     */
    setResponseHeader(event, 'cache-control', 'no-store');
    setResponseHeader(event, 'vary', 'Authorization');
    // 链路追踪号与耗时通过响应头下发：不触碰业务信封，真实后端可直接照搬
    if (context.traceId) {
      setResponseHeader(event, 'x-request-id', context.traceId);
      setResponseHeader(event, 'x-trace-id', context.traceId);
    }
    setResponseHeader(event, 'x-response-time', `${durationMs}ms`);
    if (outcome.status !== undefined && outcome.status !== 200)
      setResponseStatus(event, outcome.status);
    recordApiAudit({ ...route, method }, context, outcome, startedAt, durationMs);
    return outcome.body;
  });
}

/** 从 h3 事件抽取处理器上下文；body 解析失败按无请求体处理（与 legacy 空串→空对象一致） */
export async function toRouteInput(
  event: H3Event,
  path: string,
): Promise<MockRouteInput> {
  const rawBody = await readBody(event).catch(() => null);
  const body = normalizeBody(rawBody);
  // h3 v2 基于 Web Standards：node 上下文可选；兼容测试 fixture 的 node.req.headers。
  const nodeReq = (event as H3Event & {
    node?: { req?: { headers?: unknown; socket?: { remoteAddress?: string } } };
  }).node?.req;
  const headers = normalizeValues(
    (nodeReq?.headers ?? {}) as Record<string, string | string[] | undefined>,
  );
  const forwarded = headers['x-forwarded-for']?.split(',')[0]?.trim();

  return {
    body,
    data: body,
    headers,
    params: normalizeValues(event.context.params ?? {}),
    path,
    query: getQuery(event) as Record<string, string | string[] | undefined>,
    // 安全上下文：代理头优先，避免把负载均衡器地址当成真实来源
    clientIp:
      forwarded || headers['x-real-ip'] || nodeReq?.socket?.remoteAddress,
    traceId: headers['x-request-id'] || headers['x-trace-id'] || randomUUID(),
    userAgent: headers['user-agent'],
  };
}

/** 无请求体时统一成空对象，业务侧可直接取字段；数组等非标量体保留在 value 上 */
export function normalizeBody(rawBody: unknown): Record<string, unknown> {
  if (rawBody === undefined || rawBody === null || rawBody === '') return {};
  if (typeof rawBody === 'object' && !Array.isArray(rawBody))
    return rawBody as Record<string, unknown>;
  return { value: rawBody };
}

function isEnvelopeLike(value: unknown): value is { code: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
