import type { CacheInstance, CacheItem, CacheOptions } from "./types";
import { decryptValue, encryptValue, shouldEncrypt } from "./encrypt";
import { createStorage } from "./storage";

export { localStorageAdapter, memoryStorageAdapter, sessionStorageAdapter } from "./storage";
export type { CacheInstance, CacheItem, CacheOptions, CacheStorage, StorageType } from "./types";

const DEFAULT_PREFIX = import.meta.env.VITE_APP_TITLE || "app_cache";

function getDefaultPrefix(): string {
  return DEFAULT_PREFIX;
}

export function createCache<T = unknown>(options: CacheOptions = {}): CacheInstance<T> {
  const { type = "local", prefix = getDefaultPrefix(), encrypt = true } = options;

  const storage = createStorage(type);
  const shouldUseEncrypt = encrypt && shouldEncrypt();

  const buildKey = (key: string) => `${prefix}_${key}`;

  const serialize = async (item: CacheItem<T>): Promise<string> => {
    const json = JSON.stringify(item);
    return shouldUseEncrypt ? await encryptValue(json, prefix) : json;
  };

  const deserialize = async (data: string): Promise<CacheItem<T> | null> => {
    try {
      const json = shouldUseEncrypt ? await decryptValue(data, prefix) : data;
      return JSON.parse(json) as CacheItem<T>;
    } catch {
      return null;
    }
  };

  const removeItem = (key: string): void => {
    storage.removeItem(buildKey(key));
  };

  const getItem = async (key: string): Promise<T | null> => {
    const data = storage.getItem(buildKey(key));
    if (!data) return null;

    const dataStr = data instanceof Promise ? null : data;
    if (!dataStr) return null;

    const item = await deserialize(dataStr);
    if (!item) return null;

    if (item.expire > 0 && Date.now() > item.expire) {
      removeItem(key);
      return null;
    }

    return item.value;
  };

  const setItem = async (key: string, value: T, expire?: number): Promise<void> => {
    const item: CacheItem<T> = {
      value,
      expire: expire ? Date.now() + expire * 1000 : 0,
      time: Date.now(),
    };
    await storage.setItem(buildKey(key), await serialize(item));
  };

  const hasItem = (key: string): boolean => {
    return getItem(key) !== null;
  };

  const clear = (): void => {
    const allKeys = storage.keys();
    const keyList = allKeys instanceof Promise ? [] : allKeys;
    keyList.forEach((k) => {
      if (k.startsWith(prefix)) {
        storage.removeItem(k);
      }
    });
  };

  const keys = (): string[] => {
    const allKeys = storage.keys();
    if (allKeys instanceof Promise) {
      return [];
    }
    return allKeys.filter((k) => k.startsWith(prefix));
  };

  const getExpire = async (key: string): Promise<number | null> => {
    const data = storage.getItem(buildKey(key));
    if (!data) return null;

    const dataStr = data instanceof Promise ? null : data;
    if (!dataStr) return null;

    const item = await deserialize(dataStr);
    if (!item) return null;

    if (item.expire === 0) return null;
    return Math.max(0, Math.floor((item.expire - Date.now()) / 1000));
  };

  const setExpire = async (key: string, expire: number): Promise<boolean> => {
    const data = storage.getItem(buildKey(key));
    if (!data) return false;

    const dataStr = data instanceof Promise ? null : data;
    if (!dataStr) return false;

    const item = await deserialize(dataStr);
    if (!item) return false;

    item.expire = Date.now() + expire * 1000;
    await storage.setItem(buildKey(key), await serialize(item));
    return true;
  };

  const touch = async (key: string, expire?: number): Promise<boolean> => {
    const data = storage.getItem(buildKey(key));
    if (!data) return false;

    const dataStr = data instanceof Promise ? null : data;
    if (!dataStr) return false;

    const item = await deserialize(dataStr);
    if (!item) return false;

    if (item.expire > 0) {
      item.expire = Date.now() + (expire || 3600) * 1000;
      await storage.setItem(buildKey(key), await serialize(item));
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

export const cache = createCache();

export const localStorageCacheStorage = {
  getItem: (key: string) => cache.getItem(key) as string | null,
  setItem: (key: string, value: string) => cache.setItem(key, value),
  removeItem: (key: string) => cache.removeItem(key),
};
