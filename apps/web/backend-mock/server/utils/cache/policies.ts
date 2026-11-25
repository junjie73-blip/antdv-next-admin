/**
 * Mock 缓存策略（基于 Nitro v3 内置 nitro/cache → ocache）
 *
 * 设计点：
 * - TTL / SWR / key 模板通过 KV 配置，改完立刻生效（换一个带 generation 的缓存实例）；
 * - 只缓存只读、与会话无关的数据；按 token 分数据的接口禁止接入，否则会串号；
 * - 缓存函数注册表提供失效入口，供 cleanup 任务与控制端点调用。
 */

import { defineCachedFunction } from 'nitro/cache';
import { useKV } from 'nitro/kv';

import {
  MOCK_KV_BASE,
  MOCK_KV_KEYS,
  cachePolicySchema,
  type CachePolicy,
} from '../../contracts/runtime-kv';

/** 热点只读接口的默认策略（可被 KV 覆盖） */
const DEFAULT_POLICIES: Record<string, CachePolicy> = {
  'dict:list': { name: 'dict:list', maxAge: 300, swr: true },
  'menu:tree': { name: 'menu:tree', maxAge: 120, swr: true },
  'stats:summary': { name: 'stats:summary', maxAge: 60, swr: false },
};

type CachedFn = ((...args: never[]) => Promise<unknown>) & {
  invalidate?: (...args: unknown[]) => Promise<void>;
  expire?: (...args: unknown[]) => Promise<void>;
};

const registry = new Map<string, CachedFn>();
const generations = new Map<string, number>();

function kv() {
  return useKV(MOCK_KV_BASE) as unknown as {
    getItem<T>(key: string): Promise<T | null>;
    setItem(key: string, value: unknown): Promise<void>;
  };
}

/** 读取策略：KV 里只存发生变化的部分，与默认值合并后过 schema */
export async function getCachePolicy(name: string): Promise<CachePolicy> {
  const raw = await kv().getItem<unknown>(MOCK_KV_KEYS.CACHE_POLICIES);
  const all = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  const parsed = cachePolicySchema.safeParse({
    ...(DEFAULT_POLICIES[name] ?? { name, maxAge: 60, swr: false }),
    ...(all[name] ?? {}),
    name,
  });
  return parsed.success
    ? parsed.data
    : { name, maxAge: 60, swr: false };
}

export async function listCachePolicies(): Promise<CachePolicy[]> {
  const names = new Set([
    ...Object.keys(DEFAULT_POLICIES),
    ...[...registry.keys()].map((key) => key.split(':')[0] ?? key),
  ]);
  return Promise.all([...names].map((name) => getCachePolicy(name)));
}

/** 更新策略并让旧缓存立即失效（generation +1） */
export async function setCachePolicy(
  input: Omit<CachePolicy, 'updatedAt'> & { updatedAt?: string },
): Promise<CachePolicy> {
  const parsed = cachePolicySchema.parse({
    ...input,
    updatedAt: new Date().toISOString(),
  });
  const raw = await kv().getItem<Record<string, unknown>>(
    MOCK_KV_KEYS.CACHE_POLICIES,
  );
  await kv().setItem(MOCK_KV_KEYS.CACHE_POLICIES, {
    ...(raw ?? {}),
    [parsed.name]: parsed,
  });
  bumpGeneration(parsed.name);
  return parsed;
}

/** 缓存键模板：{0} {1} 依次替换为函数参数，未提供的占位符保留为空串 */
export function resolveKeyTemplate(
  template: string | undefined,
  args: readonly unknown[],
): string {
  if (!template) return '';
  return template.replace(/\{(\d+)\}/g, (_match, index: string) => {
    const value = args[Number(index)];
    return value === undefined || value === null ? '' : String(value);
  });
}

/**
 * 创建可动态调参的缓存函数。
 *
 * 用法：
 *   const getDict = createMockCache('dict:list', (type: string) => queryDict(type),
 *     { getKey: (type) => type });
 */
export function createMockCache<TArgs extends unknown[], TResult>(
  name: string,
  loader: (...args: TArgs) => Promise<TResult> | TResult,
  options: { getKey?: (...args: TArgs) => string } = {},
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const policy = await getCachePolicy(name);
    if (policy.maxAge === 0) return loader(...args);

    const generation = generations.get(name) ?? 0;
    const key = `${name}:${generation}:${policy.maxAge}:${policy.swr}`;
    let fn = registry.get(key) as CachedFn | undefined;
    if (!fn) {
      // generation 必须进入实际缓存键，否则重建包装函数后仍会命中旧条目，
      // "改配置立即生效"就只是表象。
      const getKey = (...cachedArgs: unknown[]) => {
        const userKey = options.getKey
          ? options.getKey(...(cachedArgs as TArgs))
          : resolveKeyTemplate(policy.keyTemplate, cachedArgs) ||
            JSON.stringify(cachedArgs);
        return `g${generation}:${userKey}`;
      };
      fn = defineCachedFunction(
        loader as (...args: unknown[]) => Promise<unknown>,
        {
          maxAge: policy.maxAge,
          swr: policy.swr,
          name: name.replace(/[^A-Za-z0-9_]/g, '_'),
          group: 'mock',
          getKey,
        },
      ) as CachedFn;
      registry.set(key, fn);
    }
    return fn(...(args as unknown as never[])) as Promise<TResult>;
  };
}

function bumpGeneration(name: string): void {
  generations.set(name, (generations.get(name) ?? 0) + 1);
  for (const key of [...registry.keys()])
    if (key.startsWith(`${name}:`)) registry.delete(key);
}

/** 失效缓存：不传 name 则全部失效（cleanup 任务用） */
export function invalidateMockCaches(name?: string): number {
  const before = registry.size;
  if (name) bumpGeneration(name);
  else {
    registry.clear();
    for (const key of generations.keys()) bumpGeneration(key);
  }
  return before - registry.size;
}

/** 供控制端点展示当前活跃缓存实例数（按 name 统计） */
export function cacheRegistryStats(): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const key of registry.keys()) {
    const name = key.split(':')[0] ?? key;
    stats[name] = (stats[name] ?? 0) + 1;
  }
  return stats;
}
