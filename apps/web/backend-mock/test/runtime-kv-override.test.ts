import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MockRouteInput } from '../server/utils/runtime';

import {
  clearMockKv,
  setGlobalConfig,
  setRouteOverride,
} from '../server/utils/kv/mock-kv';
import { resolveKvHandler } from '../server/utils/runtime';
import { resetKvFixture } from './fixtures/nitro-kv';

const KEY = '[GET]/menus';

function context(): MockRouteInput {
  return {
    body: {},
    data: {},
    headers: {},
    params: {},
    path: '/menus',
    query: {},
  };
}

describe('KV 覆盖在运行时实时生效', () => {
  beforeEach(async () => {
    resetKvFixture();
    await clearMockKv();
  });

  it('没有覆盖时执行原 handler', async () => {
    const original = vi.fn(async () => ({ code: 200, data: 'original', message: 'ok' }));
    const handler = await resolveKvHandler(KEY, original);
    await handler(context());
    expect(original).toHaveBeenCalledTimes(1);
  });

  it('response 覆盖直接替换返回值，无需改 handler', async () => {
    const original = vi.fn(async () => 'original');
    await setRouteOverride({
      routeKey: KEY,
      response: { list: [], source: 'kv' },
    });
    const handler = await resolveKvHandler(KEY, original);
    const result = (await handler(context())) as {
      code: number;
      data: unknown;
    };

    expect(result.code).toBe(200);
    expect(result.data).toEqual({ list: [], source: 'kv' });
    expect(original).not.toHaveBeenCalled();
  });

  it('delayMs 覆盖产生真实等待', async () => {
    await setRouteOverride({ routeKey: KEY, delayMs: 80 });
    const handler = await resolveKvHandler(KEY, async () => 'ok');
    const started = Date.now();
    await handler(context());
    expect(Date.now() - started).toBeGreaterThanOrEqual(70);
  });

  it('enabled=false 与 statusCode 覆盖返回标准错误信封', async () => {
    await setRouteOverride({ routeKey: KEY, enabled: false });
    let result = (await (
      await resolveKvHandler(KEY, async () => 'ok')
    )(context())) as { code: number; data: unknown };
    expect(result.code).toBe(503);
    expect(result.data).toBeNull();

    await setRouteOverride({ routeKey: KEY, statusCode: 403 });
    const forbidden = (await (
      await resolveKvHandler(KEY, async () => 'ok')
    )(context())) as { code: number };
    expect(forbidden.code).toBe(403);
  });

  it('全局关闭覆盖后回到原 handler', async () => {
    await setRouteOverride({ routeKey: KEY, response: { override: true } });
    await setGlobalConfig({ overridesEnabled: false });
    const original = vi.fn(async () => 'original');
    const handler = await resolveKvHandler(KEY, original);
    expect(await handler(context())).toBe('original');
    expect(original).toHaveBeenCalledTimes(1);
  });
});
