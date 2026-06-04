import type { CacheInstance, CacheItem, CacheOptions } from './types'
import { decryptValue, encryptValue, shouldEncrypt } from './encrypt'
import { createStorage } from './storage'

export { localStorageAdapter, memoryStorageAdapter, sessionStorageAdapter } from './storage'
export type { CacheInstance, CacheItem, CacheOptions, CacheStorage, StorageType } from './types'

const DEFAULT_PREFIX = import.meta.env.VITE_APP_TITLE || 'app_cache'

function getDefaultPrefix(): string {
  return DEFAULT_PREFIX
}

export function createCache<T = unknown>(options: CacheOptions = {}): CacheInstance<T> {
  const {
    type = 'local',
    prefix = getDefaultPrefix(),
    encrypt = true,
  } = options

  const storage = createStorage(type)
  const shouldUseEncrypt = encrypt && shouldEncrypt()

  const buildKey = (key: string) => `${prefix}_${key}`

  const serialize = (item: CacheItem<T>): string => {
    const json = JSON.stringify(item)
    return shouldUseEncrypt ? encryptValue(json, prefix) : json
  }

  const deserialize = (data: string): CacheItem<T> | null => {
    try {
      const json = shouldUseEncrypt ? decryptValue(data, prefix) : data
      return JSON.parse(json) as CacheItem<T>
    }
    catch {
      return null
    }
  }

  const removeItem = (key: string): void => {
    storage.removeItem(buildKey(key))
  }

  const getItem = (key: string): T | null => {
    const data = storage.getItem(buildKey(key))
    if (!data)
      return null

    const dataStr = data instanceof Promise ? null : data
    if (!dataStr)
      return null

    const item = deserialize(dataStr)
    if (!item)
      return null

    if (item.expire > 0 && Date.now() > item.expire) {
      removeItem(key)
      return null
    }

    return item.value
  }

  const setItem = (key: string, value: T, expire?: number): void => {
    const item: CacheItem<T> = {
      value,
      expire: expire ? Date.now() + expire * 1000 : 0,
      time: Date.now(),
    }
    storage.setItem(buildKey(key), serialize(item))
  }

  const hasItem = (key: string): boolean => {
    return getItem(key) !== null
  }

  const clear = (): void => {
    const allKeys = storage.keys()
    const keyList = allKeys instanceof Promise ? [] : allKeys
    keyList.forEach((k) => {
      if (k.startsWith(prefix)) {
        storage.removeItem(k)
      }
    })
  }

  const keys = (): string[] => {
    const allKeys = storage.keys()
    if (allKeys instanceof Promise) {
      return []
    }
    return allKeys.filter(k => k.startsWith(prefix))
  }

  const getExpire = (key: string): number | null => {
    const data = storage.getItem(buildKey(key))
    if (!data)
      return null

    const dataStr = data instanceof Promise ? null : data
    if (!dataStr)
      return null

    const item = deserialize(dataStr)
    if (!item)
      return null

    if (item.expire === 0)
      return null
    return Math.max(0, Math.floor((item.expire - Date.now()) / 1000))
  }

  const setExpire = (key: string, expire: number): boolean => {
    const data = storage.getItem(buildKey(key))
    if (!data)
      return false

    const dataStr = data instanceof Promise ? null : data
    if (!dataStr)
      return false

    const item = deserialize(dataStr)
    if (!item)
      return false

    item.expire = Date.now() + expire * 1000
    storage.setItem(buildKey(key), serialize(item))
    return true
  }

  const touch = (key: string, expire?: number): boolean => {
    const data = storage.getItem(buildKey(key))
    if (!data)
      return false

    const dataStr = data instanceof Promise ? null : data
    if (!dataStr)
      return false

    const item = deserialize(dataStr)
    if (!item)
      return false

    if (item.expire > 0) {
      item.expire = Date.now() + (expire || 3600) * 1000
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

export const cache = createCache()

export const localStorageCacheStorage = {
  getItem: (key: string) => cache.getItem(key) as string | null,
  setItem: (key: string, value: string) => cache.setItem(key, value),
  removeItem: (key: string) => cache.removeItem(key),
}
