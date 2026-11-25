/**
 * `nitro/cache` 的测试替身
 *
 * 用 Map + 时间戳复刻 defineCachedFunction 的核心语义：TTL、命中不重算、
 * invalidate/expire/resolveKeys。缓存策略测试直接基于它验证 key 规则与动态 TTL。
 */

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

interface CacheOptions {
  maxAge?: number;
  name?: string;
  group?: string;
  getKey?: (...args: unknown[]) => string;
}

const store = new Map<string, CacheEntry>();

function keyOf(options: CacheOptions, args: unknown[]): string {
  const key = options.getKey
    ? options.getKey(...args)
    : JSON.stringify(args);
  return `${options.group ?? 'nitro/functions'}:${options.name ?? 'fn'}:${key}`;
}

export function defineCachedFunction<T extends (...args: never[]) => unknown>(
  fn: T,
  options: CacheOptions = {},
): T & {
  invalidate: (...args: unknown[]) => Promise<void>;
  expire: (...args: unknown[]) => Promise<void>;
  resolveKeys: (...args: unknown[]) => Promise<string>;
} {
  const maxAge = options.maxAge ?? 1;
  const wrapped = (async (...args: unknown[]) => {
    const key = keyOf(options, args);
    const hit = store.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value;
    const value = await fn(...(args as never[]));
    store.set(key, { value, expiresAt: Date.now() + maxAge * 1000 });
    return value;
  }) as unknown as T & {
    invalidate: (...args: unknown[]) => Promise<void>;
    expire: (...args: unknown[]) => Promise<void>;
    resolveKeys: (...args: unknown[]) => Promise<string>;
  };

  wrapped.invalidate = async (...args: unknown[]) => {
    store.delete(keyOf(options, args));
  };
  wrapped.expire = async (...args: unknown[]) => {
    const entry = store.get(keyOf(options, args));
    if (entry) entry.expiresAt = 0;
  };
  wrapped.resolveKeys = async (...args: unknown[]) => keyOf(options, args);
  return wrapped;
}

export function defineCachedHandler<T extends (...args: never[]) => unknown>(
  handler: T,
): T {
  return handler;
}

/** 单测隔离 */
export function resetCacheFixture(): void {
  store.clear();
}

/** 供断言缓存条目与 TTL */
export function cacheFixtureEntries(): Array<{ key: string; expiresAt: number }> {
  return [...store.entries()].map(([key, entry]) => ({
    key,
    expiresAt: entry.expiresAt,
  }));
}
