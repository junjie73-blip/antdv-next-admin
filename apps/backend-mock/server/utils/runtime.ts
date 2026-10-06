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

import type { RouteManifestItem } from './store';

import { performance } from 'node:perf_hooks';

import {
  defineEventHandler,
  getQuery,
  readBody,
  setResponseStatus,
} from '#imports';

import { envelope } from './response';
import { keyOf, methodOf, moduleOf, shouldInjectFailure } from './route-meta';
import { pushLog, recordHit, registerManifest, resolveRuntime } from './store';

/**
 * h3 事件的最小结构类型：只声明本层实际用到的字段，
 * 避免与 h3 具体版本的类型强耦合（defineEventHandler 注入的真实事件满足该结构）。
 */
export interface MockEvent {
  context: { params?: Record<string, string | string[] | undefined> };
  method: string;
  path: string;
}

/**
 * 处理器入参：与 legacy MockContext 对齐的便捷视图。
 * - `data`：已解析的请求体，无 body 时是空对象
 * - `params`：路由参数（`:id` 捕获值）
 * - `path`：注册时的路径，不含查询串，也不含 /api 前缀
 *
 * legacy 的 headers 字段没有任何业务 handler 消费，这里保留字段但恒为空对象，
 * 免去 h3 各版本 headers 载体差异（v1 node 原生对象 / v2 Headers）。
 */
export interface MockRouteInput {
  body: Record<string, unknown>;
  data: Record<string, unknown>;
  headers: Record<string, string>;
  params: Record<string, string>;
  path: string;
  /** 原始查询参数：同名多值是数组（login-log 的 dateRange 依赖该语义），与 legacy 一致不做拍平 */
  query: Record<string, string | string[] | undefined>;
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
  let body: unknown = null;

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

    const result = await run(context);
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

  return defineEventHandler(async (event) => {
    const context = await toRouteInput(
      event as unknown as MockEvent,
      definition.path,
    );
    const outcome = await executeWithRuntime(
      route,
      definition.handler,
      context,
    );
    if (outcome.status !== undefined && outcome.status !== 200)
      setResponseStatus(event, outcome.status);
    return outcome.body;
  });
}

/** 从 h3 事件抽取处理器上下文；body 解析失败按无请求体处理（与 legacy 空串→空对象一致） */
export async function toRouteInput(
  event: MockEvent,
  path: string,
): Promise<MockRouteInput> {
  const rawBody = await readBody(event).catch(() => null);
  const body = normalizeBody(rawBody);

  return {
    body,
    data: body,
    headers: {},
    params: normalizeValues(event.context.params ?? {}),
    path,
    query: getQuery(event) as Record<string, string | string[] | undefined>,
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
