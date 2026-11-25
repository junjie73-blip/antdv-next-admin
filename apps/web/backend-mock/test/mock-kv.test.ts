import { beforeEach, describe, expect, it } from 'vitest';

import {
  MOCK_KV_KEYS,
  routeOverrideKey,
} from '../server/contracts/runtime-kv';
import {
  appendTaskHistory,
  clearMockKv,
  getGeneratedSnapshot,
  getGlobalConfig,
  getRouteOverride,
  listRouteOverrides,
  listTaskHistory,
  removeRouteOverride,
  setGeneratedSnapshot,
  setGlobalConfig,
  setRouteOverride,
  trimTaskHistory,
} from '../server/utils/kv/mock-kv';
import { resetKvFixture } from './fixtures/nitro-kv';

describe('Mock KV 运行时配置', () => {
  beforeEach(async () => {
    resetKvFixture();
    await clearMockKv();
  });

  it('空 KV 返回安全默认值', async () => {
    expect(await getGlobalConfig()).toEqual({
      defaultDelayMs: 0,
      overridesEnabled: true,
    });
    expect(await listRouteOverrides()).toEqual([]);
  });

  it('全局配置可读写，脏数据回落到默认值', async () => {
    const next = await setGlobalConfig({ defaultDelayMs: 250 });
    expect(next.defaultDelayMs).toBe(250);
    expect((await getGlobalConfig()).defaultDelayMs).toBe(250);

    // 直接写脏值：schema 校验失败时必须回落而不是抛错打挂服务
    const { useKV } = await import('./fixtures/nitro-kv');
    await useKV('mock').setItem(MOCK_KV_KEYS.GLOBAL, { defaultDelayMs: -1 });
    expect(await getGlobalConfig()).toEqual({
      defaultDelayMs: 0,
      overridesEnabled: true,
    });
  });

  it('单接口覆盖可增删改查，键按 routeKey 编码隔离', async () => {
    const first = {
      routeKey: '[GET]/menus',
      delayMs: 120,
      response: { list: [] },
    };
    const second = { routeKey: '[POST]/auth/login', enabled: false };

    await setRouteOverride(first);
    await setRouteOverride(second);

    expect((await getRouteOverride(first.routeKey))?.delayMs).toBe(120);
    expect((await getRouteOverride(second.routeKey))?.enabled).toBe(false);
    expect((await listRouteOverrides()).map((item) => item.routeKey)).toEqual([
      '[GET]/menus',
      '[POST]/auth/login',
    ]);

    expect(await removeRouteOverride(first.routeKey)).toBe(true);
    expect(await getRouteOverride(first.routeKey)).toBeNull();
    expect(await removeRouteOverride(first.routeKey)).toBe(false);
    expect(routeOverrideKey(first.routeKey)).toContain('overrides/');
  });

  it('非法覆盖参数被 schema 拒绝', async () => {
    await expect(
      setRouteOverride({ routeKey: '[GET]/x', delayMs: 99_999 }),
    ).rejects.toThrow();
  });

  it('任务历史追加、截断与快照写入均持久化到 KV', async () => {
    for (let i = 0; i < 6; i += 1) {
      await appendTaskHistory({
        at: new Date(i).toISOString(),
        durationMs: i,
        name: 'mock:cleanup',
        ok: true,
        source: 'manual',
      });
    }
    expect(await listTaskHistory()).toHaveLength(6);
    expect(await trimTaskHistory(2)).toBe(4);
    expect(await listTaskHistory()).toHaveLength(2);

    await setGeneratedSnapshot({ count: 3 });
    expect((await getGeneratedSnapshot())?.data).toEqual({ count: 3 });
  });
});
