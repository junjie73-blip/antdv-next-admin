import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createMockCache,
  getCachePolicy,
  invalidateMockCaches,
  listCachePolicies,
  resolveKeyTemplate,
  setCachePolicy,
} from '../server/utils/cache/policies';
import { cacheFixtureEntries, resetCacheFixture } from './fixtures/nitro-cache';
import { resetKvFixture } from './fixtures/nitro-kv';

describe('缓存策略与自定义 key', () => {
  beforeEach(() => {
    resetKvFixture();
    resetCacheFixture();
    invalidateMockCaches();
  });

  it('默认策略可被 KV 覆盖且立即生效', async () => {
    expect((await getCachePolicy('dict:list')).maxAge).toBe(300);
    await setCachePolicy({ name: 'dict:list', maxAge: 10, swr: false });
    const policy = await getCachePolicy('dict:list');
    expect(policy.maxAge).toBe(10);
    expect(policy.swr).toBe(false);
    expect((await listCachePolicies()).find((p) => p.name === 'dict:list')?.maxAge).toBe(10);
  });

  it('key 模板用 {0}/{1} 顺序替换参数', () => {
    expect(resolveKeyTemplate('type:{0}:page:{1}', ['user', 2])).toBe(
      'type:user:page:2',
    );
    expect(resolveKeyTemplate('a:{0}:{2}', ['x'])).toBe('a:x:');
    expect(resolveKeyTemplate(undefined, ['x'])).toBe('');
  });

  it('相同参数命中缓存不重复执行 loader，不同参数互不串数据', async () => {
    const loader = vi.fn(async (type: string) => ({ type, at: Date.now() }));
    const cached = createMockCache('stats:summary', loader, {
      getKey: (type) => type,
    });

    const first = await cached('user');
    const second = await cached('user');
    await cached('role');

    expect(loader).toHaveBeenCalledTimes(2);
    expect(second).toEqual(first);
    expect(cacheFixtureEntries().map((e) => e.key)).toEqual(
      expect.arrayContaining([expect.stringContaining('stats_summary')]),
    );
  });

  it('maxAge=0 时绕过缓存；TTL 到期后重新计算', async () => {
    const loader = vi.fn(async (value: number) => value + 1);
    const uncached = createMockCache('no-cache', loader);
    await setCachePolicy({ name: 'no-cache', maxAge: 0, swr: false });
    await uncached(1);
    await uncached(1);
    expect(loader).toHaveBeenCalledTimes(2);

    const loader2 = vi.fn(async (value: number) => value * 10);
    const short = createMockCache('short', loader2);
    await setCachePolicy({ name: 'short', maxAge: 0.001, swr: false });
    await short(2);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await short(2);
    expect(loader2).toHaveBeenCalledTimes(2);
  });

  it('失效缓存后下一次调用重新执行 loader', async () => {
    const loader = vi.fn(async (key: string) => `${key}-v1`);
    const cached = createMockCache('menu:tree', loader, { getKey: (k) => k });
    await cached('a');
    expect(loader).toHaveBeenCalledTimes(1);

    expect(invalidateMockCaches('menu:tree')).toBeGreaterThan(0);
    await cached('a');
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
