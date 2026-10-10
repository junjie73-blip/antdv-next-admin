import type { CacheInstance } from '@antdv/shared/cache';

import { effectScope, isRef, nextTick } from 'vue';

import { buildStorageKey, cache } from '@antdv/shared/cache';
import { configureSharedEnv } from '@antdv/shared/env';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCache } from '../src/useCache';

/**
 * `cache` 的写入最终落到 localStorage，这里直接拦 Storage.prototype.setItem
 * 来数「同一个值被写了几次」——双重落盘是本模块重构前的真实症状。
 */
/**
 * 计数 localStorage 写入。
 * 只能拦 `localStorage` 实例：happy-dom 的 Storage 实例方法不走 Storage.prototype
 * （原型上 spy 一次都不会命中），而实例上的 setItem 又是继承来的属性，
 * spyOn 会在实例上生成一个新的影子方法——正好是我们想要的拦截点。
 * 注意必须继续调用 original，否则 cache.getItem 读不到刚写的值。
 */
function spyStorageWrite() {
  const calls: Array<[string, string]> = [];
  const original = localStorage.setItem.bind(localStorage);
  const spy = vi
    .spyOn(localStorage, 'setItem')
    .mockImplementation((key: string, value: string) => {
      calls.push([key, value]);
      original(key, value);
    });
  return { calls, spy };
}

describe('useCache', () => {
  let scope: ReturnType<typeof effectScope>;

  beforeEach(() => {
    configureSharedEnv({ cachePrefix: 't_cache' });
    localStorage.clear();
    scope = effectScope();
  });

  afterEach(() => {
    scope.stop();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  const run = <T>(fn: () => T): T => scope.run(fn) as T;

  it('value 是可写的 customRef（对外类型仍是 Ref）', () => {
    const { value } = run(() => useCache<string>('shape'));
    expect(isRef(value)).toBe(true);
    expect(() => {
      value.value = 'ok';
    }).not.toThrow();
  });

  it('缓存为空时读到默认值，且不会把默认值偷偷写进缓存', () => {
    const { value } = run(() => useCache<string>('profile', { defaultValue: 'guest' }));
    expect(value.value).toBe('guest');
    expect(cache.hasItem('profile')).toBe(false);
  });

  it('赋值即落盘，读回来的仍是同一个值', () => {
    const { value } = run(() => useCache<{ name: string }>('profile'));
    value.value = { name: 'Tom' };
    expect(cache.getItem('profile')).toEqual({ name: 'Tom' });

    // 重新挂载（模拟刷新页面）应当读到上次写入的值
    const second = run(() => useCache<{ name: string }>('profile'));
    expect(second.value.value).toEqual({ name: 'Tom' });
  });

  it('一次赋值只写一次盘：setter 与 deep watch 不能各写一遍', () => {
    const { calls, spy } = spyStorageWrite();
    const { value } = run(() => useCache<{ n: number }>('counter'));

    value.value = { n: 1 };
    spy.mockRestore();

    expect(value.value).toEqual({ n: 1 });
    expect(calls.filter(([key]) => key === buildStorageKey('counter'))).toHaveLength(
      1,
    );
  });

  it('写 null 等价于删除', () => {
    const { value } = run(() => useCache<string>('token', { defaultValue: 'seed' }));
    value.value = 'abc';
    expect(cache.hasItem('token')).toBe(true);
    value.value = null;
    expect(cache.hasItem('token')).toBe(false);
    // removeItem 之后回落到默认值，而不是停在 null
    expect(value.value).toBe('seed');
  });

  it('deep: true 时嵌套改动能落盘；deep: false 时不落盘', async () => {
    const { value: deep } = run(() =>
      useCache<{ list: number[] }>('deep', { deep: true }),
    );
    deep.value = { list: [1] };
    deep.value!.list.push(2);
    await nextTick();
    expect(cache.getItem('deep')).toEqual({ list: [1, 2] });

    const { value: shallow } = run(() =>
      useCache<{ list: number[] }>('shallow', { deep: false }),
    );
    shallow.value = { list: [1] };
    shallow.value!.list.push(2);
    await nextTick();
    expect(cache.getItem('shallow')).toEqual({ list: [1] });
  });

  it('用返回的 setItem 写入时同步响应式值，且不二次落盘', () => {
    const { calls, spy } = spyStorageWrite();
    const store = run(() => useCache<string>('theme'));
    store.setItem('theme', 'dark');
    spy.mockRestore();

    expect(store.value.value).toBe('dark');
    expect(calls.filter(([key]) => key === 't_cache_theme')).toHaveLength(1);
  });

  it('removeItem 只有作用在自己键上时才回拉响应式值', () => {
    const a = run(() => useCache<string>('a', { defaultValue: 'A0' }));
    const b = run(() => useCache<string>('b', { defaultValue: 'B0' }));
    a.value.value = 'A1';
    b.value.value = 'B1';

    // 已知取舍：只有作用在自己的键上时才回拉响应式值，
    // 别的实例要感知得靠 refresh() 或跨标签页的 storage 事件。
    a.removeItem('b');
    expect(b.getItem('b')).toBeNull();
    expect(b.value.value).toBe('B1');
    expect(a.value.value).toBe('A1');
  });

  it('clear 清掉整个前缀，但别的 useCache 实例不会自动感知', () => {
    const a = run(() => useCache<string>('ca', { defaultValue: 'A0' }));
    const b = run(() => useCache<string>('cb', { defaultValue: 'B0' }));
    a.value.value = 'A1';
    b.value.value = 'B1';

    a.clear();
    expect(a.value.value).toBe('A0');
    // 已知取舍：`clear()` 的作用域是整个前缀，b 的响应式值不会被回拉，
    // 缓存层已经读不到了（getItem 为 null）。真要跨实例广播就得引入共享订阅，
    // 成本远大于收益。
    expect(b.getItem('cb')).toBeNull();
    expect(b.value.value).toBe('B1');
  });

  it('immediate 会把默认值先写进缓存', () => {
    run(() =>
      useCache<string>('preset', { defaultValue: 'v1', immediate: true }),
    );
    expect(cache.getItem('preset')).toBe('v1');
  });

  it('收到本前缀的 storage 事件时重读，别的键不触发', () => {
    const { value } = run(() => useCache<string>('session'));
    value.value = 'local';

    // 模拟另一个标签页写入（cache 单例 + 同一个键）
    cache.setItem('session', 'from-tab-b');
    window.dispatchEvent(
      Object.assign(new Event('storage'), { key: buildStorageKey('session') }),
    );
    expect(value.value).toBe('from-tab-b');

    cache.setItem('other', 'x');
    window.dispatchEvent(
      Object.assign(new Event('storage'), { key: buildStorageKey('other') }),
    );
    expect(value.value).toBe('from-tab-b');
  });

  it('过期的条目读不到，回落到默认值', () => {
    vi.useFakeTimers();
    try {
      const typed = cache as CacheInstance<string>;
      typed.setItem('ttl', 'alive', 1);
      const { value } = run(() =>
        useCache<string>('ttl', { defaultValue: 'gone' }),
      );
      expect(value.value).toBe('alive');

      vi.advanceTimersByTime(1500);
      // 过期判定发生在读取时，所以要用 refresh 路径（重挂载）验证
      const reloaded = run(() => useCache<string>('ttl', { defaultValue: 'gone' }));
      expect(reloaded.value.value).toBe('gone');
    } finally {
      vi.useRealTimers();
    }
  });

  it('expire 选项会写进缓存条目，getExpire 能读出来', () => {
    const { value, getExpire } = run(() =>
      useCache<string>('ttl2', { expire: 60 }),
    );
    value.value = 'x';
    const left = getExpire('ttl2');
    expect(left).not.toBeNull();
    expect(left as number).toBeGreaterThan(50);
    expect(left as number).toBeLessThanOrEqual(60);
  });
});
