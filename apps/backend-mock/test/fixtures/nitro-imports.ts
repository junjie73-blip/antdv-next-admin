/**
 * `#imports` 的测试替身（由 vitest.config.ts 的 alias 生效）
 *
 * 只提供 server 侧实际用到的 h3 / Nitro API，并保持最小语义：
 * defineEventHandler 原样返回处理函数，事件对象用 TestEvent 承载 body / query / params / status，
 * 于是可以直接在测试里 `await handler(event)` 验证整条运行时管道。
 */

export interface TestEvent {
  body?: unknown;
  context: { params?: Record<string, undefined | string | string[]> };
  method?: string;
  path?: string;
  query?: Record<string, undefined | string | string[]>;
  status?: number;
}

export function defineEventHandler<T extends (event: TestEvent) => unknown>(
  handler: T,
): T {
  return handler;
}

export function defineNitroPlugin<T extends (nitroApp: unknown) => unknown>(
  setup: T,
): T {
  return setup;
}

export function useRuntimeConfig(): { stateFile: string } {
  return { stateFile: '.mock-state.json' };
}

export function getQuery(
  event: TestEvent,
): Record<string, undefined | string | string[]> {
  return event.query ?? {};
}

export function readBody<T = unknown>(
  event: TestEvent,
): Promise<T | undefined> {
  return Promise.resolve(event.body as T | undefined);
}

export function getRouterParams(
  event: TestEvent,
): Record<string, undefined | string | string[]> {
  return event.context.params ?? {};
}

export function getMethod(event: TestEvent): string {
  return event.method ?? 'GET';
}

export function getRequestURL(event: TestEvent): { pathname: string } {
  return { pathname: event.path ?? '/' };
}

export function setResponseStatus(event: TestEvent, status: number): void {
  event.status = status;
}

/** 便于测试构造事件对象 */
export function createTestEvent(
  init: Partial<Omit<TestEvent, 'context'>> & {
    params?: Record<string, string>;
  } = {},
): TestEvent {
  const { params, ...rest } = init;
  return { ...rest, context: { params } };
}
