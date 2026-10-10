import { beforeEach, describe, expect, it } from 'vitest';

import { cache, createCache } from '../src/cache';
import { configureSharedEnv } from '../src/env';

const PREFIX = 'unit_cache';

beforeEach(() => {
  configureSharedEnv({
    cacheEncryptKey: 'unit-test-key-0123456789abcdef',
    cachePrefix: PREFIX,
    production: false,
  });
  localStorage.clear();
});

/**
 * 每个用例单独 createCache：加密开关与前缀现在都是「用时再解析」，
 * 但 `type`（local / memory）仍然是创建时定型的，跨用例共用实例会串存储介质。
 */
function makeStore<T>(options: { encrypt?: boolean } = {}) {
  return createCache<T>({
    prefix: PREFIX,
    type: 'local',
    ...options,
  });
}

describe('createCache 明文模式', () => {
  it('写入后可读回，键带前缀', () => {
    const store = makeStore<{ id: number }>({ encrypt: false });
    store.setItem('user', { id: 1 });
    expect(store.getItem('user')).toEqual({ id: 1 });
    expect(localStorage.getItem(`${PREFIX}_user`)).toContain('"id":1');
  });

  it('未过期时 getExpire 返回剩余秒数，无限期返回 null', () => {
    const store = makeStore<{ id: number }>({ encrypt: false });
    store.setItem('lease', { id: 9 }, 600);
    const remain = store.getExpire('lease');
    expect(remain).not.toBeNull();
    expect(remain!).toBeGreaterThan(590);
    expect(remain!).toBeLessThanOrEqual(600);

    store.setItem('forever', { id: 10 });
    expect(store.getExpire('forever')).toBeNull();
  });

  it('过期后读取为 null 并顺手删除', () => {
    const store = makeStore<{ id: number }>({ encrypt: false });
    store.setItem('short', { id: 2 });
    // 负数 TTL 把过期时间推到过去，等价于「已过期的条目」
    expect(store.setExpire('short', -10)).toBe(true);
    expect(store.getItem('short')).toBeNull();
    expect(localStorage.getItem(`${PREFIX}_short`)).toBeNull();
  });

  it('touch 只续期本来就会过期的条目', () => {
    const store = makeStore<{ id: number }>({ encrypt: false });
    store.setItem('lease', { id: 3 }, 10);
    expect(store.touch('lease', 3600)).toBe(true);
    expect(store.getExpire('lease')! > 3000).toBe(true);

    store.setItem('forever', { id: 4 });
    expect(store.touch('forever')).toBe(true);
    expect(store.getExpire('forever')).toBeNull();

    expect(store.touch('missing')).toBe(false);
  });

  it('hasItem / removeItem / keys 以前缀为作用域', () => {
    const store = makeStore<{ id: number }>({ encrypt: false });
    store.setItem('a', { id: 3 });
    localStorage.setItem('other_key', 'keep');
    expect(store.hasItem('a')).toBe(true);
    expect(store.keys()).toEqual([`${PREFIX}_a`]);
    store.removeItem('a');
    expect(store.hasItem('a')).toBe(false);
  });

  it('坏数据降级为 null，不让业务侧抛异常', () => {
    const store = makeStore<{ id: number }>({ encrypt: false });
    localStorage.setItem(`${PREFIX}_broken`, '{oops');
    expect(store.getItem('broken')).toBeNull();
    expect(store.hasItem('broken')).toBe(false);
    expect(store.setExpire('broken', 10)).toBe(false);
  });
});

describe('createCache 加密模式', () => {
  it('生产环境下落盘不是明文，读回仍是原值', () => {
    configureSharedEnv({ production: true });
    const store = makeStore<string>({ encrypt: true });
    store.setItem('token', 'Bearer secret-value');
    const raw = localStorage.getItem(`${PREFIX}_token`) ?? '';
    expect(raw).not.toContain('secret-value');
    expect(store.getItem('token')).toBe('Bearer secret-value');
  });

  it('非生产环境不落密文', () => {
    const store = makeStore<string>({ encrypt: true });
    store.setItem('plain', 'hello');
    expect(localStorage.getItem(`${PREFIX}_plain`)).toContain('hello');
  });

  it('生产环境下用另一套前缀解密会失败并降级为 null', () => {
    configureSharedEnv({ production: true });
    const store = makeStore<string>({ encrypt: true });
    store.setItem('token', 'Bearer secret-value');
    // 前缀参与密钥派生，换个前缀就读不出来了
    const thief = createCache<string>({
      encrypt: true,
      prefix: 'other_prefix',
      type: 'local',
    });
    localStorage.setItem('other_prefix_token', rawOf(`${PREFIX}_token`));
    expect(thief.getItem('token')).toBeNull();
  });
});

describe('clear', () => {
  it('只清理当前前缀的键', () => {
    const store = makeStore<string>({ encrypt: false });
    store.setItem('a', '1');
    store.setItem('b', '2');
    localStorage.setItem('other_key', 'keep');
    store.clear();
    expect(localStorage.getItem('other_key')).toBe('keep');
    expect(localStorage.getItem(`${PREFIX}_a`)).toBeNull();
    expect(localStorage.getItem(`${PREFIX}_b`)).toBeNull();
  });
});

describe('memory 存储', () => {
  it('不落 localStorage，读回正常', () => {
    const local = makeStore<string>({ encrypt: false });
    const mem = createCache<string>({ prefix: PREFIX, type: 'memory' });
    mem.setItem('x', 'y');
    expect(mem.getItem('x')).toBe('y');
    expect(local.getItem('x')).toBeNull();
    expect(mem.keys()).toContain(`${PREFIX}_x`);
    mem.clear();
    expect(mem.getItem('x')).toBeNull();
  });
});

describe('配置注入时机', () => {
  /**
   * 回归用例：`export const cache = createCache()` 在模块求值时就执行了，
   * 而应用的 `configureSharedEnv()` 要到 main.ts 才跑（import 提升决定了先后）。
   * 早前的实现把前缀和加密开关在创建时定型，结果单例永远用默认前缀 'app_cache'，
   * 应用配的前缀一个字节都写不上，clear() 也清不掉真正的数据。
   */
  it('模块级单例 cache 按最新配置的前缀落盘', () => {
    cache.setItem('late', 'value');
    expect(localStorage.getItem(`${PREFIX}_late`)).toContain('value');
    expect(cache.getItem('late')).toBe('value');
    cache.clear();
    expect(localStorage.getItem(`${PREFIX}_late`)).toBeNull();
  });

  it('未显式传 prefix 时跟随配置变化，显式传了则以显式为准', () => {
    const dynamic = createCache<string>({ encrypt: false });
    configureSharedEnv({ cachePrefix: 'prefix_b' });
    dynamic.setItem('k', 'v');
    expect(localStorage.getItem('prefix_b_k')).toContain('v');

    const fixed = createCache<string>({ encrypt: false, prefix: 'fixed' });
    fixed.setItem('k', 'v');
    expect(localStorage.getItem('fixed_k')).toContain('v');
  });

  it('加密开关也用时再判：建实例后切到生产环境依然落密文', () => {
    const store = createCache<string>({ encrypt: true });
    store.setItem('plain', 'hello');
    expect(localStorage.getItem(`${PREFIX}_plain`)).toContain('hello');

    configureSharedEnv({ production: true });
    store.setItem('secret', 'Bearer abc');
    expect(localStorage.getItem(`${PREFIX}_secret`)).not.toContain('Bearer abc');
    expect(store.getItem('secret')).toBe('Bearer abc');
  });
});

/** 直接读原始落盘值 */
function rawOf(key: string): string {
  return localStorage.getItem(key) ?? '';
}
