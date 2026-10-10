import type { CacheInstance, CacheItem, CacheOptions } from './types';

import { isNil, isPromise } from 'es-toolkit';

import { getCachePrefix } from '../env';
import { decryptValueSync, encryptValueSync, shouldEncrypt } from './encrypt';
import { createStorage } from './storage';

export {
  localStorageAdapter,
  memoryStorageAdapter,
  sessionStorageAdapter,
} from './storage';
export { decryptToken, encryptToken } from './tokenCrypto';
export type {
  CacheEntry,
  CacheInstance,
  CacheItem,
  CacheOptions,
  CacheStorage,
  StorageType,
  UseCacheOptions,
  UseCacheReturn,
} from './types';

/**
 * 默认键前缀来自 `configureSharedEnv()`（见 src/env.ts）。
 *
 * 包内不读 `import.meta.env`：这里的产物是给 Vite 直接消费的 ESM，
 * 而 env 静态替换只作用于应用自己的源码，包里读到 import.meta.env 会是 undefined。
 */

/**
 * 计算业务键在底层存储里的真实键名。
 *
 * 单独导出是因为：前缀拼接规则属于 cache 的内部约定，
 * 而监听 `storage` 事件的调用方（如跨标签页同步的 `useCache`）也需要它。
 * 让外部抄一遍 `${prefix}_${key}`，将来改规则就会两边不一致。
 */
export function buildStorageKey(
  key: string,
  prefix: string = getCachePrefix(),
): string {
  return `${prefix}_${key}`;
}

/**
 * 创建缓存实例
 *
 * @param options - 缓存配置
 * @returns 缓存实例
 *
 * @example
 * ```ts
 * const userCache = createCache<UserInfo>({ type: 'local', prefix: 'user' })
 * userCache.setItem('profile', { ... }, 3600)
 * const profile = userCache.getItem('profile')
 * ```
 */
export function createCache<T = unknown>(
  options: CacheOptions = {},
): CacheInstance<T> {
  const { type = 'local', encrypt = true } = options;

  const storage = createStorage(type);

  /**
   * ⚠️ 前缀和加密开关都必须「每次用时再取」，不能在创建实例时定型。
   *
   * `export const cache = createCache()` 在模块求值时就跑了，而应用的
   * `configureSharedEnv()` 在 main.ts 里才执行——ESM 的 import 提升决定了
   * 一定是先建实例、后配置。当时定型的版本会把所有键写死成默认前缀，
   * 应用配的前缀一个字节都用不上，`clear()` 也清不掉真正的数据。
   */
  const resolvePrefix = (): string => options.prefix ?? getCachePrefix();
  const useEncrypt = (): boolean => encrypt && shouldEncrypt();

  const buildKey = (key: string): string => buildStorageKey(key, resolvePrefix());

  /** 序列化：JSON → 可选 SM4 加密 */
  const serialize = (item: CacheItem<T>, prefix: string): string => {
    const json = JSON.stringify(item);
    return useEncrypt() ? encryptValueSync(json, prefix) : json;
  };

  /** 反序列化：可选 SM4 解密 → JSON，失败返回 null */
  const deserialize = (data: string, prefix: string): CacheItem<T> | null => {
    try {
      const json = useEncrypt() ? decryptValueSync(data, prefix) : data;
      return JSON.parse(json) as CacheItem<T>;
    } catch {
      return null;
    }
  };

  /** 读取原始字符串（同步适配器专用，异步适配器返回 null） */
  const readRaw = (key: string): null | string => {
    const data = storage.getItem(buildKey(key));
    if (isPromise(data)) return null;
    return data;
  };

  const removeItem = (key: string): void => {
    storage.removeItem(buildKey(key));
  };

  const getItem = (key: string): null | T => {
    const data = readRaw(key);
    if (!data) return null;

    const item = deserialize(data, resolvePrefix());
    if (isNil(item)) return null;

    if (item.expire > 0 && Date.now() > item.expire) {
      removeItem(key);
      return null;
    }

    return item.value;
  };

  const setItem = (key: string, value: T, expire?: number): void => {
    const now = Date.now();
    const item: CacheItem<T> = {
      value,
      expire: expire && expire > 0 ? now + expire * 1000 : 0,
      createTime: now,
      // 兼容旧字段
      time: now,
    };
    storage.setItem(buildKey(key), serialize(item, resolvePrefix()));
  };

  const hasItem = (key: string): boolean => getItem(key) !== null;

  const clear = (): void => {
    const prefix = resolvePrefix();
    const allKeys = storage.keys();
    if (isPromise(allKeys)) return;
    for (const key of allKeys) {
      if (key.startsWith(prefix)) storage.removeItem(key);
    }
  };

  const keys = (): string[] => {
    const prefix = resolvePrefix();
    const allKeys = storage.keys();
    if (isPromise(allKeys)) return [];
    return allKeys.filter((key) => key.startsWith(prefix));
  };

  const getExpire = (key: string): null | number => {
    const data = readRaw(key);
    if (!data) return null;
    const item = deserialize(data, resolvePrefix());
    if (isNil(item) || item.expire === 0) return null;
    return Math.max(0, Math.floor((item.expire - Date.now()) / 1000));
  };

  const setExpire = (key: string, expire: number): boolean => {
    const data = readRaw(key);
    if (!data) return false;
    const item = deserialize(data, resolvePrefix());
    if (isNil(item)) return false;
    item.expire = Date.now() + expire * 1000;
    storage.setItem(buildKey(key), serialize(item, resolvePrefix()));
    return true;
  };

  const touch = (key: string, expire?: number): boolean => {
    const data = readRaw(key);
    if (!data) return false;
    const item = deserialize(data, resolvePrefix());
    if (isNil(item)) return false;
    if (item.expire > 0) {
      item.expire = Date.now() + (expire ?? 3600) * 1000;
      storage.setItem(buildKey(key), serialize(item, resolvePrefix()));
    }
    return true;
  };

  return {
    getItem,
    setItem,
    removeItem,
    hasItem,
    clear,
    keys,
    getExpire,
    setExpire,
    touch,
  };
}

/** 默认缓存实例 */
export const cache: CacheInstance = createCache();

/** 兼容旧 API 的 localStorage 封装 */
export const localStorageCacheStorage = {
  getItem: (key: string): unknown => cache.getItem(key),
  setItem: (key: string, value: string): void => cache.setItem(key, value),
  removeItem: (key: string): void => cache.removeItem(key),
};
