import type { Ref } from 'vue'

/** 存储类型 */
export type StorageType = 'local' | 'session' | 'memory'

/** 缓存实例配置 */
export interface CacheOptions {
  /** 存储类型，默认 'local' */
  type?: StorageType
  /** 键前缀，默认取 VITE_APP_TITLE */
  prefix?: string
  /** 是否启用加密（仅生产环境生效），默认 true */
  encrypt?: boolean
}

/** 缓存存储项 */
export interface CacheItem<T = unknown> {
  /** 存储值 */
  value: T
  /** 过期时间戳（毫秒），0 表示永不过期 */
  expire: number
  /** 创建时间戳（毫秒） */
  createTime: number
  /** @deprecated 兼容旧字段，等同于 createTime */
  time?: number
}

/** 底层存储适配器 */
export interface CacheStorage {
  getItem: (key: string) => string | null | Promise<string | null>
  setItem: (key: string, value: string) => void | Promise<void>
  removeItem: (key: string) => void | Promise<void>
  clear: () => void | Promise<void>
  keys: () => string[] | Promise<string[]>
}

/** 缓存实例 */
export interface CacheInstance<T = unknown> {
  /** 读取值，过期或不存在返回 null */
  getItem: (key: string) => T | null
  /** 写入值，expire 单位秒 */
  setItem: (key: string, value: T, expire?: number) => void
  /** 移除指定键 */
  removeItem: (key: string) => void
  /** 键是否存在且未过期 */
  hasItem: (key: string) => boolean
  /** 清空当前前缀下的所有键 */
  clear: () => void
  /** 列出当前前缀下的所有键 */
  keys: () => string[]
  /** 获取剩余过期时间（秒），永不过期返回 null */
  getExpire: (key: string) => number | null
  /** 设置过期时间（秒），成功返回 true */
  setExpire: (key: string, expire: number) => boolean
  /** 刷新过期时间，不传 expire 时使用 3600 秒 */
  touch: (key: string, expire?: number) => boolean
}

/** 键值对条目（用于 useCache 批量操作） */
export interface CacheEntry<T = unknown> {
  key: string
  value: T
  expire?: number
}

/** useCache 组合式函数的配置 */
export interface UseCacheOptions {
  /** 默认值：键不存在时返回 */
  defaultValue?: unknown
  /** 过期时间（秒），0 表示永不过期 */
  expire?: number
  /** 是否深度监听 value 变化并自动写回 */
  deep?: boolean
  /** 是否立即写回默认值 */
  immediate?: boolean
}

/** useCache 组合式函数的返回值 */
export interface UseCacheReturn<T = unknown> extends CacheInstance<T> {
  /** 响应式值：读时从缓存取，写时自动持久化 */
  readonly value: Ref<T | null>
  /** 当前缓存键 */
  readonly key: string
}
