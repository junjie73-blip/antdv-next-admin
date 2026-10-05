import { isNil, isPromise } from 'es-toolkit'

import type { CacheInstance, CacheItem, CacheOptions } from './types'

import { decryptValueSync, encryptValueSync, shouldEncrypt } from './encrypt'
import { createStorage } from './storage'

export {
  localStorageAdapter,
  memoryStorageAdapter,
  sessionStorageAdapter,
} from './storage'
export type {
  CacheEntry,
  CacheInstance,
  CacheItem,
  CacheOptions,
  CacheStorage,
  StorageType,
  UseCacheOptions,
  UseCacheReturn,
} from './types'

/** 默认键前缀 */
const DEFAULT_PREFIX: string =
  (import.meta.env.VITE_APP_TITLE as string | undefined) || 'app_cache'

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
  const { type = 'local', prefix = DEFAULT_PREFIX, encrypt = true } = options

  const storage = createStorage(type)
  const shouldUseEncrypt = encrypt && shouldEncrypt()

  const buildKey = (key: string): string => `${prefix}_${key}`

  /** 序列化：JSON → 可选 SM4 加密 */
  const serialize = (item: CacheItem<T>): string => {
    const json = JSON.stringify(item)
    return shouldUseEncrypt ? encryptValueSync(json, prefix) : json
  }

  /** 反序列化：可选 SM4 解密 → JSON，失败返回 null */
  const deserialize = (data: string): CacheItem<T> | null => {
    try {
      const json = shouldUseEncrypt ? decryptValueSync(data, prefix) : data
      return JSON.parse(json) as CacheItem<T>
    } catch {
      return null
    }
  }

  /** 读取原始字符串（同步适配器专用，异步适配器返回 null） */
  const readRaw = (key: string): string | null => {
    const data = storage.getItem(buildKey(key))
    if (isPromise(data)) return null
    return data
  }

  const removeItem = (key: string): void => {
    storage.removeItem(buildKey(key))
  }

  const getItem = (key: string): T | null => {
    const data = readRaw(key)
    if (!data) return null

    const item = deserialize(data)
    if (isNil(item)) return null

    if (item.expire > 0 && Date.now() > item.expire) {
      removeItem(key)
      return null
    }

    return item.value
  }

  const setItem = (key: string, value: T, expire?: number): void => {
    const now = Date.now()
    const item: CacheItem<T> = {
      value,
      expire: expire && expire > 0 ? now + expire * 1000 : 0,
      createTime: now,
      // 兼容旧字段
      time: now,
    }
    storage.setItem(buildKey(key), serialize(item))
  }

  const hasItem = (key: string): boolean => getItem(key) !== null

  const clear = (): void => {
    const allKeys = storage.keys()
    if (isPromise(allKeys)) return
    for (const key of allKeys) {
      if (key.startsWith(prefix)) storage.removeItem(key)
    }
  }

  const keys = (): string[] => {
    const allKeys = storage.keys()
    if (isPromise(allKeys)) return []
    return allKeys.filter((key) => key.startsWith(prefix))
  }

  const getExpire = (key: string): number | null => {
    const data = readRaw(key)
    if (!data) return null
    const item = deserialize(data)
    if (isNil(item) || item.expire === 0) return null
    return Math.max(0, Math.floor((item.expire - Date.now()) / 1000))
  }

  const setExpire = (key: string, expire: number): boolean => {
    const data = readRaw(key)
    if (!data) return false
    const item = deserialize(data)
    if (isNil(item)) return false
    item.expire = Date.now() + expire * 1000
    storage.setItem(buildKey(key), serialize(item))
    return true
  }

  const touch = (key: string, expire?: number): boolean => {
    const data = readRaw(key)
    if (!data) return false
    const item = deserialize(data)
    if (isNil(item)) return false
    if (item.expire > 0) {
      item.expire = Date.now() + (expire ?? 3600) * 1000
      storage.setItem(buildKey(key), serialize(item))
    }
    return true
  }

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
  }
}

/** 默认缓存实例 */
export const cache: CacheInstance = createCache()

/** 兼容旧 API 的 localStorage 封装 */
export const localStorageCacheStorage = {
  getItem: (key: string): unknown => cache.getItem(key),
  setItem: (key: string, value: string): void => cache.setItem(key, value),
  removeItem: (key: string): void => cache.removeItem(key),
}
