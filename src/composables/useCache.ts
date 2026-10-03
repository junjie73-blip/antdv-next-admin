import type { RemovableRef } from '@vueuse/core'

import { useStorage } from '@vueuse/core'
import { isNil } from 'es-toolkit'
import { computed } from 'vue'

import type { CacheInstance, UseCacheOptions, UseCacheReturn } from '../utils/cache/types'

import { cache } from '../utils/cache/index'

/** 默认过期时间（秒），0 表示永不过期 */
const DEFAULT_EXPIRE = 0

/**
 * 响应式缓存组合式函数
 *
 * 使用 vueuse 的 `useStorage` 提供响应式能力：
 *  - `value.value` 读取 → 自动从缓存取（含过期判断）
 *  - `value.value = xxx` → 自动写回缓存
 *  - 跨标签页同步（同一浏览器）
 *
 * ⚠️ 与 `cache` 单例的区别：
 *  - `cache` 是纯同步 KV 存储，无响应式
 *  - `useCache` 基于 ref，适合在组件内使用
 *
 * @example
 * ```ts
 * const { value, removeItem, hasItem } = useCache<UserInfo>('user-info')
 * value.value = { name: 'Tom' }  // 写入缓存
 * console.log(value.value)       // 读取缓存
 * ```
 */
export function useCache<T = unknown>(key: string, options: UseCacheOptions = {}): UseCacheReturn<T> {
  const { defaultValue = null, expire = DEFAULT_EXPIRE, deep = true } = options

  // 使用 cache 单例读写，保持一致的加密/前缀策略
  const cacheInstance = cache as CacheInstance<T>

  /** 包装成 vueuse useStorage 能识别的 serializer */
  const serializer = {
    read: (raw: string): T | null => {
      try {
        const parsed = JSON.parse(raw) as { value?: T }
        return parsed?.value ?? null
      } catch {
        return null
      }
    },
    write: (value: T | null): string => {
      return JSON.stringify({ value })
    },
  }

  /**
   * 判断当前缓存项是否存在
   */
  const hasCache = cacheInstance.hasItem(key)

  // 初始值：优先从缓存取，否则用默认值
  const initialValue: T | null = hasCache ? cacheInstance.getItem(key) : (defaultValue as T | null)

  // 使用 useStorage 提供响应式包装（跨标签页同步）
  const storageRef: RemovableRef<string> = useStorage(
    key,
    hasCache ? JSON.stringify({ value: initialValue }) : serializer.write(initialValue as T),
    // 使用 localStorage，useStorage 会自动注入监听
    typeof window !== 'undefined' ? window.localStorage : undefined,
    {
      deep,
      // 序列化器：useStorage 内部认为它存的是 string，所以读写时用它
      serializer: {
        read: (raw: string) => raw,
        write: (value: string) => value,
      },
    },
  )

  /**
   * 响应式值：读时反序列化 → T，写时序列化 → 落缓存
   */
  const value = computed<T | null>({
    get: () => {
      try {
        return serializer.read(storageRef.value) as T | null
      } catch {
        return (defaultValue as T | null) ?? null
      }
    },
    set: (next: T | null) => {
      storageRef.value = serializer.write(next)
      // 同时写回 cache 单例，保证 getExpire / hasItem 等 API 语义一致
      if (isNil(next)) {
        cacheInstance.removeItem(key)
      } else {
        cacheInstance.setItem(key, next as T, expire)
      }
    },
  })

  return {
    key,
    value,
    // 透传 cache 单例的所有方法，保持 API 一致
    getItem: cacheInstance.getItem,
    setItem: cacheInstance.setItem,
    removeItem: cacheInstance.removeItem,
    hasItem: cacheInstance.hasItem,
    clear: cacheInstance.clear,
    keys: cacheInstance.keys,
    getExpire: cacheInstance.getExpire,
    setExpire: cacheInstance.setExpire,
    touch: cacheInstance.touch,
  }
}
