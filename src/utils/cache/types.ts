export type StorageType = 'local' | 'session' | 'memory'

export interface CacheOptions {
  type?: StorageType
  prefix?: string
  encrypt?: boolean
}

export interface CacheItem<T> {
  value: T
  expire: number
  createTime: number
}

export interface CacheStorage {
  getItem: (key: string) => string | null | Promise<string | null>
  setItem: (key: string, value: string) => void | Promise<void>
  removeItem: (key: string) => void | Promise<void>
  clear: () => void | Promise<void>
  keys: () => string[] | Promise<string[]>
}

export interface CacheInstance<T = unknown> {
  getItem: (key: string) => T | null
  setItem: (key: string, value: T, expire?: number) => void
  removeItem: (key: string) => void
  hasItem: (key: string) => boolean
  clear: () => void
  keys: () => string[]
  getExpire: (key: string) => number | null
  setExpire: (key: string, expire: number) => boolean
  touch: (key: string, expire?: number) => boolean
}
