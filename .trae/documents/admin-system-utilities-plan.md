# 通用型后台系统工具函数开发计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 完善通用型后台系统的核心工具函数，包括缓存、HTTP请求、加密、事件、日期、DOM等模块，确保系统的完整性、可扩展性和可维护性。

**Architecture:** 采用模块化设计，每个工具函数独立封装，支持 Tree-shaking。缓存模块支持多种存储类型，生产环境自动加密；HTTP 请求模块基于 Axios 封装，支持重试、等待、取消、暂停等高级功能；加密模块整合 jose（JWT）、sm-crypto（国密）、spark-md5（MD5）等现有依赖。

**Tech Stack:** Vue 3.5 + TypeScript 5.9 + Pinia 3 + Axios + jose + sm-crypto + spark-md5 + es-toolkit + @vueuse/core + mitt + dayjs

---

## 项目现状分析

### 已有依赖（可直接使用）
| 类别 | 依赖 | 用途 |
|------|------|------|
| HTTP 请求 | axios | HTTP 客户端 |
| 加密安全 | jose, sm-crypto, spark-md5 | JWT、国密、MD5 |
| 类型判断 | es-toolkit | isObject, isArray 等 |
| 工具函数 | @vueuse/core, dayjs, nanoid | 通用工具 |
| CSS 工具 | clsx, tailwind-merge | 类名合并 |
| 事件总线 | mitt | 事件发布订阅 |

### 项目规则约束
1. 缓存使用 `localStorageCacheStorage` 从 `@/utils/cache` 导入
2. CSS 类名使用 `cn` 从 `@/utils/cn` 导入
3. 类型判断使用 `es-toolkit` 方法
4. DOM 操作使用 `useTemplateRef`

### 需要创建的文件
```
src/utils/
├── cache/
│   ├── index.ts              # 缓存入口
│   ├── types.ts              # 类型定义
│   ├── storage.ts            # 存储适配器
│   ├── memory.ts             # 内存存储
│   └── encrypt.ts            # 加密处理
├── cn/
│   └── index.ts              # CSS 类名合并
├── crypto/
│   ├── index.ts              # 加密入口
│   ├── types.ts              # 类型定义
│   ├── aes.ts                # AES 加解密
│   ├── hash.ts               # 哈希计算
│   └── jwt.ts                # JWT 处理
├── request/
│   ├── index.ts              # 请求入口
│   ├── types.ts              # 类型定义
│   ├── instance.ts           # Axios 实例
│   ├── interceptors.ts       # 拦截器
│   ├── retry.ts              # 重试机制
│   └── cancel.ts             # 取消请求
├── event/
│   ├── index.ts              # 事件总线入口
│   ├── types.ts              # 类型定义
│   └── bus.ts                # 事件总线实现
├── dateUtil/
│   ├── index.ts              # 日期工具入口
│   ├── types.ts              # 类型定义
│   └── format.ts             # 格式化函数
├── dom/
│   ├── index.ts              # DOM 工具入口
│   ├── types.ts              # 类型定义
│   ├── class.ts              # 类名操作
│   ├── style.ts              # 样式操作
│   └── scroll.ts             # 滚动相关
├── token/
│   └── index.ts              # Token 管理
├── welcome/
│   └── index.ts              # 欢迎消息
└── helpers/
    └── menu/
        └── index.ts          # 菜单生成
src/api/
├── index.ts                  # API 入口
└── request.ts                # API 定义
```

---

## Task 1: 开发缓存工具函数 (cache)

**Files:**
- Create: `src/utils/cache/types.ts`
- Create: `src/utils/cache/storage.ts`
- Create: `src/utils/cache/memory.ts`
- Create: `src/utils/cache/encrypt.ts`
- Create: `src/utils/cache/index.ts`
- Test: `src/utils/__tests__/cache.test.ts`

### 1.1 类型定义

```typescript
// src/utils/cache/types.ts
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
```

### 1.2 存储适配器

```typescript
// src/utils/cache/storage.ts
import type { CacheStorage, StorageType } from './types'

export function createStorage(type: StorageType): CacheStorage {
  switch (type) {
    case 'local':
      return {
        getItem: (key: string) => localStorage.getItem(key),
        setItem: (key: string, value: string) => localStorage.setItem(key, value),
        removeItem: (key: string) => localStorage.removeItem(key),
        clear: () => {
          localStorage.clear()
        },
        keys: () => Object.keys(localStorage),
      }
    case 'session':
      return {
        getItem: (key: string) => sessionStorage.getItem(key),
        setItem: (key: string, value: string) => sessionStorage.setItem(key, value),
        removeItem: (key: string) => sessionStorage.removeItem(key),
        clear: () => {
          sessionStorage.clear()
        },
        keys: () => Object.keys(sessionStorage),
      }
    case 'memory':
      return createMemoryStorage()
  }
}

function createMemoryStorage(): CacheStorage {
  const store = new Map<string, string>()

  return {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
    keys: () => Array.from(store.keys()),
  }
}

export const localStorageAdapter = createStorage('local')
export const sessionStorageAdapter = createStorage('session')
export const memoryStorageAdapter = createStorage('memory')
```

### 1.3 内存存储

```typescript
// src/utils/cache/memory.ts
export class MemoryCache {
  private store = new Map<string, { value: string; expire?: number }>()
  private timers = new Map<string, ReturnType<typeof setTimeout>>()

  set(key: string, value: string, expire?: number): void {
    this.delete(key)

    this.store.set(key, { value, expire })

    if (expire && expire > 0) {
      const timer = setTimeout(() => {
        this.delete(key)
      }, expire * 1000)
      this.timers.set(key, timer)
    }
  }

  get(key: string): string | null {
    const item = this.store.get(key)
    if (!item) return null

    if (item.expire && Date.now() > item.expire) {
      this.delete(key)
      return null
    }

    return item.value
  }

  delete(key: string): void {
    const timer = this.timers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(key)
    }
    this.store.delete(key)
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  clear(): void {
    this.timers.forEach(timer => clearTimeout(timer))
    this.timers.clear()
    this.store.clear()
  }

  keys(): string[] {
    return Array.from(this.store.keys())
  }
}

export const memoryCache = new MemoryCache()
```

### 1.4 加密处理

```typescript
// src/utils/cache/encrypt.ts
import { sm4 } from 'sm-crypto'

const DEFAULT_KEY = 'antdv-next-admin-cache-key'

function padKey(key: string): string {
  if (key.length < 32) {
    return key.padEnd(32, '0')
  }
  return key.slice(0, 32)
}

export function encryptValue(value: string, key?: string): string {
  const finalKey = padKey(key || DEFAULT_KEY)
  return sm4.encrypt(value, finalKey)
}

export function decryptValue(value: string, key?: string): string {
  const finalKey = padKey(key || DEFAULT_KEY)
  return sm4.decrypt(value, finalKey)
}

export function shouldEncrypt(): boolean {
  return import.meta.env.PROD
}
```

### 1.5 缓存核心实现

```typescript
// src/utils/cache/index.ts
import type { CacheOptions, CacheItem, CacheInstance, CacheStorage } from './types'
import { createStorage } from './storage'
import { encryptValue, decryptValue, shouldEncrypt } from './encrypt'

export type { CacheOptions, CacheItem, CacheInstance, CacheStorage, StorageType } from './types'
export { localStorageAdapter, sessionStorageAdapter, memoryStorageAdapter } from './storage'

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
    } catch {
      return null
    }
  }

  const getItem = (key: string): T | null => {
    const data = storage.getItem(buildKey(key))
    if (!data) return null

    const item = deserialize(data)
    if (!item) return null

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
      createTime: Date.now(),
    }
    storage.setItem(buildKey(key), serialize(item))
  }

  const removeItem = (key: string): void => {
    storage.removeItem(buildKey(key))
  }

  const hasItem = (key: string): boolean => {
    return getItem(key) !== null
  }

  const clear = (): void => {
    const allKeys = storage.keys()
    allKeys.forEach((k) => {
      if (k.startsWith(prefix)) {
        storage.removeItem(k)
      }
    })
  }

  const keys = (): string[] => {
    const allKeys = storage.keys()
    return allKeys.filter(k => k.startsWith(prefix))
  }

  const getExpire = (key: string): number | null => {
    const data = storage.getItem(buildKey(key))
    if (!data) return null

    const item = deserialize(data)
    if (!item) return null

    if (item.expire === 0) return null
    return Math.max(0, Math.floor((item.expire - Date.now()) / 1000))
  }

  const setExpire = (key: string, expire: number): boolean => {
    const data = storage.getItem(buildKey(key))
    if (!data) return false

    const item = deserialize(data)
    if (!item) return false

    item.expire = Date.now() + expire * 1000
    storage.setItem(buildKey(key), serialize(item))
    return true
  }

  const touch = (key: string, expire?: number): boolean => {
    const data = storage.getItem(buildKey(key))
    if (!data) return false

    const item = deserialize(data)
    if (!item) return false

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
```

### 1.6 单元测试

```typescript
// src/utils/__tests__/cache.test.ts
import { describe, expect, it, beforeEach } from 'vitest'
import { createCache, cache } from '../cache'

describe('cache', () => {
  beforeEach(() => {
    cache.clear()
  })

  describe('basic operations', () => {
    it('should set and get value', () => {
      cache.setItem('test', { name: 'test' })
      expect(cache.getItem('test')).toEqual({ name: 'test' })
    })

    it('should return null for non-existent key', () => {
      expect(cache.getItem('non-existent')).toBeNull()
    })

    it('should remove value', () => {
      cache.setItem('test', 'value')
      cache.removeItem('test')
      expect(cache.getItem('test')).toBeNull()
    })

    it('should check if key exists', () => {
      cache.setItem('test', 'value')
      expect(cache.hasItem('test')).toBe(true)
      expect(cache.hasItem('non-existent')).toBe(false)
    })
  })

  describe('expire', () => {
    it('should expire value', async () => {
      const memoryCache = createCache({ type: 'memory', prefix: 'test_' })
      memoryCache.setItem('expire', 'value', 1)
      await new Promise(resolve => setTimeout(resolve, 1100))
      expect(memoryCache.getItem('expire')).toBeNull()
    })

    it('should get expire time', () => {
      cache.setItem('test', 'value', 3600)
      const expire = cache.getExpire('test')
      expect(expire).toBeGreaterThan(3590)
      expect(expire).toBeLessThanOrEqual(3600)
    })

    it('should set expire time', () => {
      cache.setItem('test', 'value')
      expect(cache.getExpire('test')).toBeNull()
      cache.setExpire('test', 1800)
      expect(cache.getExpire('test')).toBeGreaterThan(1790)
    })

    it('should touch key', () => {
      cache.setItem('test', 'value', 60)
      const expire1 = cache.getExpire('test')
      cache.touch('test', 120)
      const expire2 = cache.getExpire('test')
      expect(expire2).toBeGreaterThan(expire1!)
    })
  })

  describe('storage types', () => {
    it('should work with session storage', () => {
      const sessionCache = createCache({ type: 'session', prefix: 'session_' })
      sessionCache.setItem('test', 'session-value')
      expect(sessionCache.getItem('test')).toBe('session-value')
    })

    it('should work with memory storage', () => {
      const memoryCache = createCache({ type: 'memory', prefix: 'memory_' })
      memoryCache.setItem('test', 'memory-value')
      expect(memoryCache.getItem('test')).toBe('memory-value')
    })
  })

  describe('keys', () => {
    it('should list all keys', () => {
      cache.setItem('key1', 'value1')
      cache.setItem('key2', 'value2')
      const keys = cache.keys()
      expect(keys.length).toBeGreaterThanOrEqual(2)
    })

    it('should clear all keys', () => {
      cache.setItem('key1', 'value1')
      cache.setItem('key2', 'value2')
      cache.clear()
      expect(cache.keys().length).toBe(0)
    })
  })
})
```

### 1.7 提交代码

```bash
git add src/utils/cache src/utils/__tests__/cache.test.ts
git commit -m "feat(utils): add cache utility with type/encrypt/expire support"
```

---

## Task 2: 开发 CSS 类名合并工具 (cn)

**Files:**
- Create: `src/utils/cn/index.ts`
- Test: `src/utils/__tests__/cn.test.ts`

### 2.1 实现 cn 函数

```typescript
// src/utils/cn/index.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

### 2.2 单元测试

```typescript
// src/utils/__tests__/cn.test.ts
import { describe, expect, it } from 'vitest'
import { cn } from '../cn'

describe('cn', () => {
  it('should merge class names', () => {
    expect(cn('bg-red-500', 'text-white')).toBe('bg-red-500 text-white')
  })

  it('should handle conditional classes', () => {
    expect(cn('base', false && 'hidden', true && 'visible')).toBe('base visible')
  })

  it('should merge tailwind classes correctly', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
  })

  it('should handle undefined and null', () => {
    expect(cn('base', undefined, null, 'end')).toBe('base end')
  })
})
```

### 2.3 提交代码

```bash
git add src/utils/cn src/utils/__tests__/cn.test.ts
git commit -m "feat(utils): add cn utility for tailwind class merging"
```

---

## Task 3: 开发加密工具函数 (crypto)

**Files:**
- Create: `src/utils/crypto/types.ts`
- Create: `src/utils/crypto/hash.ts`
- Create: `src/utils/crypto/aes.ts`
- Create: `src/utils/crypto/jwt.ts`
- Create: `src/utils/crypto/index.ts`
- Test: `src/utils/__tests__/crypto.test.ts`

### 3.1 类型定义

```typescript
// src/utils/crypto/types.ts
export interface HashOptions {
  algorithm?: 'md5' | 'sha256'
}

export interface AesOptions {
  key: string
  iv?: string
}

export interface JwtPayload {
  [key: string]: unknown
  exp?: number
  iat?: number
}

export interface JwtOptions {
  secret: string
  expiresIn?: string | number
}
```

### 3.2 哈希计算

```typescript
// src/utils/crypto/hash.ts
import SparkMD5 from 'spark-md5'

export function md5(data: string): string {
  return SparkMD5.hash(data)
}

export function md5File(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const spark = new SparkMD5.ArrayBuffer()
    const reader = new FileReader()

    reader.onload = (e) => {
      if (e.target?.result) {
        spark.append(e.target.result as ArrayBuffer)
        resolve(spark.end())
      }
    }

    reader.onerror = () => {
      reject(new Error('File read error'))
    }

    reader.readAsArrayBuffer(file)
  })
}

export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export function hash(data: string, options: { algorithm?: 'md5' | 'sha256' } = {}): string | Promise<string> {
  const { algorithm = 'md5' } = options
  return algorithm === 'md5' ? md5(data) : sha256(data)
}
```

### 3.3 AES 加解密

```typescript
// src/utils/crypto/aes.ts
import { sm4 } from 'sm-crypto'
import type { AesOptions } from './types'

const DEFAULT_KEY = '0123456789abcdeffedcba9876543210'

function padKey(key: string): string {
  if (key.length < 32) {
    return key.padEnd(32, '0')
  }
  return key.slice(0, 32)
}

export function encrypt(data: string, options: AesOptions): string {
  const key = padKey(options.key || DEFAULT_KEY)
  return sm4.encrypt(data, key)
}

export function decrypt(data: string, options: AesOptions): string {
  const key = padKey(options.key || DEFAULT_KEY)
  return sm4.decrypt(data, key)
}

export function encryptObject<T extends Record<string, unknown>>(obj: T, options: AesOptions): string {
  return encrypt(JSON.stringify(obj), options)
}

export function decryptObject<T>(data: string, options: AesOptions): T {
  const decrypted = decrypt(data, options)
  return JSON.parse(decrypted) as T
}
```

### 3.4 JWT 处理

```typescript
// src/utils/crypto/jwt.ts
import type { JwtOptions, JwtPayload } from './types'
import * as jose from 'jose'

export async function signJwt(payload: JwtPayload, options: JwtOptions): Promise<string> {
  const { secret, expiresIn } = options
  const secretKey = new TextEncoder().encode(secret)

  const signOptions: jose.SignOptions = {}
  if (expiresIn) {
    if (typeof expiresIn === 'number') {
      signOptions.expiresIn = `${expiresIn}s`
    } else {
      signOptions.expiresIn = expiresIn
    }
  }

  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(secretKey)
}

export async function verifyJwt<T = JwtPayload>(token: string, secret: string): Promise<T | null> {
  try {
    const secretKey = new TextEncoder().encode(secret)
    const { payload } = await jose.jwtVerify(token, secretKey)
    return payload as T
  } catch {
    return null
  }
}

export function decodeJwt<T = JwtPayload>(token: string): T | null {
  try {
    const payload = jose.decodeJwt(token)
    return payload as T
  } catch {
    return null
  }
}

export function isJwtExpired(token: string): boolean {
  const payload = decodeJwt(token)
  if (!payload?.exp) return true
  return Date.now() >= payload.exp * 1000
}
```

### 3.5 导出入口

```typescript
// src/utils/crypto/index.ts
export type { HashOptions, AesOptions, JwtPayload, JwtOptions } from './types'
export { md5, md5File, sha256, hash } from './hash'
export { encrypt, decrypt, encryptObject, decryptObject } from './aes'
export { signJwt, verifyJwt, decodeJwt, isJwtExpired } from './jwt'
```

### 3.6 单元测试

```typescript
// src/utils/__tests__/crypto.test.ts
import { describe, expect, it } from 'vitest'
import { md5, sha256, encrypt, decrypt, signJwt, verifyJwt, decodeJwt, isJwtExpired } from '../crypto'

describe('crypto', () => {
  describe('hash', () => {
    it('should compute md5 hash', () => {
      expect(md5('hello')).toBe('5d41402abc4b2a76b9719d911017c592')
    })

    it('should compute sha256 hash', async () => {
      const hash = await sha256('hello')
      expect(hash).toHaveLength(64)
    })
  })

  describe('aes', () => {
    const options = { key: 'test-key-12345678' }

    it('should encrypt and decrypt string', () => {
      const encrypted = encrypt('hello', options)
      const decrypted = decrypt(encrypted, options)
      expect(decrypted).toBe('hello')
    })

    it('should encrypt and decrypt object', () => {
      const obj = { name: 'test', value: 123 }
      const encrypted = encryptObject(obj, options)
      const decrypted = decryptObject<typeof obj>(encrypted, options)
      expect(decrypted).toEqual(obj)
    })
  })

  describe('jwt', () => {
    const secret = 'test-secret-key'

    it('should sign and verify jwt', async () => {
      const token = await signJwt({ userId: '123' }, { secret })
      const payload = await verifyJwt(token, secret)
      expect(payload?.userId).toBe('123')
    })

    it('should decode jwt', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMifQ.test'
      const payload = decodeJwt(token)
      expect(payload?.userId).toBe('123')
    })

    it('should check if jwt is expired', () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjF9.test'
      expect(isJwtExpired(expiredToken)).toBe(true)
    })
  })
})
```

### 3.7 提交代码

```bash
git add src/utils/crypto src/utils/__tests__/crypto.test.ts
git commit -m "feat(utils): add crypto utility with md5/sha256/aes/jwt support"
```

---

## Task 4: 开发 HTTP 请求工具函数 (request)

**Files:**
- Create: `src/utils/request/types.ts`
- Create: `src/utils/request/instance.ts`
- Create: `src/utils/request/interceptors.ts`
- Create: `src/utils/request/retry.ts`
- Create: `src/utils/request/cancel.ts`
- Create: `src/utils/request/index.ts`
- Test: `src/utils/__tests__/request.test.ts`

### 4.1 类型定义

```typescript
// src/utils/request/types.ts
import type { AxiosRequestConfig, AxiosResponse, AxiosInstance } from 'axios'

export interface RequestConfig extends AxiosRequestConfig {
  retry?: RetryOptions
  enableCancel?: boolean
}

export interface RetryOptions {
  count?: number
  delay?: number
  condition?: (error: Error) => boolean
}

export interface Response<T = unknown> {
  code: number
  data: T
  message: string
}

export interface RequestOptions {
  baseURL?: string
  timeout?: number
  headers?: Record<string, string>
}

export interface PendingRequest {
  url: string
  method: string
  cancel: () => void
}

export interface RequestQueue {
  pending: Map<string, PendingRequest>
  pause: () => void
  resume: () => void
  clear: () => void
}
```

### 4.2 取消请求

```typescript
// src/utils/request/cancel.ts
import type { PendingRequest, RequestQueue } from './types'

function generateKey(url: string, method: string): string {
  return `${method}_${url}`
}

export function createRequestQueue(): RequestQueue {
  const pending = new Map<string, PendingRequest>()

  const pause = () => {
    pending.forEach((request) => {
      request.cancel()
    })
    pending.clear()
  }

  const resume = () => {
    // 恢复功能由外部调用者重新发起请求
  }

  const clear = () => {
    pending.forEach((request) => {
      request.cancel()
    })
    pending.clear()
  }

  return {
    pending,
    pause,
    resume,
    clear,
  }
}

export const requestQueue = createRequestQueue()
```

### 4.3 重试机制

```typescript
// src/utils/request/retry.ts
import type { AxiosError, AxiosInstance } from 'axios'
import type { RetryOptions } from './types'

const DEFAULT_RETRY_COUNT = 3
const DEFAULT_RETRY_DELAY = 1000

export function createRetryInterceptor(
  instance: AxiosInstance,
  options: RetryOptions = {},
) {
  const { count = DEFAULT_RETRY_COUNT, delay = DEFAULT_RETRY_DELAY, condition } = options

  let retryCount = 0

  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config

      if (!config) {
        return Promise.reject(error)
      }

      const shouldRetry = condition ? condition(error as Error) : isRetryableError(error)

      if (shouldRetry && retryCount < count) {
        retryCount++
        await sleep(delay)
        return instance.request(config)
      }

      retryCount = 0
      return Promise.reject(error)
    },
  )
}

function isRetryableError(error: AxiosError): boolean {
  return !error.response || error.code === 'ECONNABORTED'
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { count = DEFAULT_RETRY_COUNT, delay = DEFAULT_RETRY_DELAY, condition } = options

  let lastError: Error | null = null

  for (let i = 0; i <= count; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      const shouldRetry = condition ? condition(lastError) : true
      if (!shouldRetry || i === count) {
        throw lastError
      }

      await sleep(delay)
    }
  }

  throw lastError
}
```

### 4.4 拦截器

```typescript
// src/utils/request/interceptors.ts
import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { getToken, removeToken } from '../token'

export function createRequestInterceptor(defaultHeaders: Record<string, string> = {}) {
  return (config: InternalAxiosRequestConfig) => {
    const token = getToken()

    config.headers = {
      'Content-Type': 'application/json',
      ...defaultHeaders,
      ...config.headers,
    } as typeof config.headers

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  }
}

export function createResponseInterceptor() {
  return {
    onSuccess: (response: AxiosResponse) => {
      const { code, data, message } = response.data

      if (code === 200) {
        return data
      }

      if (code === 401) {
        removeToken()
        window.location.href = '/login'
        return Promise.reject(new Error(message || '未授权'))
      }

      return Promise.reject(new Error(message || '请求失败'))
    },
    onError: (error: AxiosError) => {
      const message = error.message || '网络错误'
      console.error('Request error:', error)
      return Promise.reject(new Error(message))
    },
  }
}
```

### 4.5 Axios 实例

```typescript
// src/utils/request/instance.ts
import axios, { type AxiosInstance } from 'axios'
import type { RequestOptions, RequestConfig } from './types'
import { createRequestInterceptor, createResponseInterceptor } from './interceptors'
import { requestQueue } from './cancel'

const DEFAULT_TIMEOUT = 10000
const DEFAULT_BASE_URL = '/api'

export function createRequest(options: RequestOptions = {}): AxiosInstance {
  const { baseURL = DEFAULT_BASE_URL, timeout = DEFAULT_TIMEOUT, headers = {} } = options

  const instance = axios.create({
    baseURL,
    timeout,
    headers,
  })

  const requestInterceptor = createRequestInterceptor(headers)
  const responseInterceptor = createResponseInterceptor()

  instance.interceptors.request.use(requestInterceptor)
  instance.interceptors.response.use(
    responseInterceptor.onSuccess,
    responseInterceptor.onError,
  )

  return instance
}

export const request = createRequest()

export async function get<T = unknown>(url: string, config?: RequestConfig): Promise<T> {
  return request.get(url, config)
}

export async function post<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
  return request.post(url, data, config)
}

export async function put<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
  return request.put(url, data, config)
}

export async function del<T = unknown>(url: string, config?: RequestConfig): Promise<T> {
  return request.delete(url, config)
}

export async function patch<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
  return request.patch(url, data, config)
}

export function cancelAllRequests(): void {
  requestQueue.clear()
}

export function pauseRequests(): void {
  requestQueue.pause()
}

export function resumeRequests(): void {
  requestQueue.resume()
}
```

### 4.6 导出入口

```typescript
// src/utils/request/index.ts
export type { RequestConfig, Response, RequestOptions, RetryOptions, RequestQueue } from './types'
export { createRequest, request, get, post, put, del, patch, cancelAllRequests, pauseRequests, resumeRequests } from './instance'
export { withRetry } from './retry'
export { requestQueue, createRequestQueue } from './cancel'
```

### 4.7 单元测试

```typescript
// src/utils/__tests__/request.test.ts
import { describe, expect, it, vi } from 'vitest'
import { withRetry, createRequestQueue } from '../request'

describe('request', () => {
  describe('withRetry', () => {
    it('should succeed on first try', async () => {
      const fn = vi.fn().mockResolvedValue('success')
      const result = await withRetry(fn)
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should retry on failure', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success')

      const result = await withRetry(fn, { count: 3, delay: 100 })
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('should throw after max retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('always fail'))

      await expect(withRetry(fn, { count: 2, delay: 100 })).rejects.toThrow('always fail')
      expect(fn).toHaveBeenCalledTimes(3)
    })
  })

  describe('createRequestQueue', () => {
    it('should create request queue', () => {
      const queue = createRequestQueue()
      expect(queue.pending).toBeInstanceOf(Map)
    })

    it('should clear all requests', () => {
      const queue = createRequestQueue()
      queue.clear()
      expect(queue.pending.size).toBe(0)
    })
  })
})
```

### 4.8 提交代码

```bash
git add src/utils/request src/utils/__tests__/request.test.ts
git commit -m "feat(utils): add request utility with retry/cancel/pause support"
```

---

## Task 5: 开发事件总线工具 (event)

**Files:**
- Create: `src/utils/event/types.ts`
- Create: `src/utils/event/bus.ts`
- Create: `src/utils/event/index.ts`
- Test: `src/utils/__tests__/event.test.ts`

### 5.1 类型定义

```typescript
// src/utils/event/types.ts
import type { Emitter } from 'mitt'

export type EventHandler<T = unknown> = (payload: T) => void

export interface EventBus extends Emitter<Record<string, unknown>> {
  on: <T = unknown>(event: string, handler: EventHandler<T>) => void
  off: <T = unknown>(event: string, handler: EventHandler<T>) => void
  emit: <T = unknown>(event: string, payload?: T) => void
  once: <T = unknown>(event: string, handler: EventHandler<T>) => void
  clear: (event?: string) => void
}
```

### 5.2 事件总线实现

```typescript
// src/utils/event/bus.ts
import mitt from 'mitt'
import type { EventBus, EventHandler } from './types'

export function createEventBus(): EventBus {
  const emitter = mitt<Record<string, unknown>>()

  const once = <T = unknown>(event: string, handler: EventHandler<T>) => {
    const wrappedHandler: EventHandler<T> = (payload) => {
      handler(payload)
      emitter.off(event, wrappedHandler as EventHandler)
    }
    emitter.on(event, wrappedHandler as EventHandler)
  }

  const clear = (event?: string) => {
    if (event) {
      emitter.all.delete(event)
    } else {
      emitter.all.clear()
    }
  }

  return {
    ...emitter,
    on: emitter.on,
    off: emitter.off,
    emit: emitter.emit,
    once,
    clear,
  }
}

export const eventBus = createEventBus()
```

### 5.3 导出入口

```typescript
// src/utils/event/index.ts
export type { EventBus, EventHandler } from './types'
export { createEventBus, eventBus } from './bus'
```

### 5.4 单元测试

```typescript
// src/utils/__tests__/event.test.ts
import { describe, expect, it, vi } from 'vitest'
import { createEventBus, eventBus } from '../event'

describe('event', () => {
  beforeEach(() => {
    eventBus.clear()
  })

  it('should emit and receive event', () => {
    const handler = vi.fn()
    eventBus.on('test', handler)
    eventBus.emit('test', { data: 'hello' })
    expect(handler).toHaveBeenCalledWith({ data: 'hello' })
  })

  it('should remove event listener', () => {
    const handler = vi.fn()
    eventBus.on('test', handler)
    eventBus.off('test', handler)
    eventBus.emit('test', { data: 'hello' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('should listen once', () => {
    const handler = vi.fn()
    eventBus.once('test', handler)
    eventBus.emit('test', { data: 'first' })
    eventBus.emit('test', { data: 'second' })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({ data: 'first' })
  })

  it('should clear all events', () => {
    const handler = vi.fn()
    eventBus.on('test1', handler)
    eventBus.on('test2', handler)
    eventBus.clear()
    eventBus.emit('test1', {})
    eventBus.emit('test2', {})
    expect(handler).not.toHaveBeenCalled()
  })

  it('should clear specific event', () => {
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    eventBus.on('test1', handler1)
    eventBus.on('test2', handler2)
    eventBus.clear('test1')
    eventBus.emit('test1', {})
    eventBus.emit('test2', {})
    expect(handler1).not.toHaveBeenCalled()
    expect(handler2).toHaveBeenCalled()
  })

  it('should create isolated event bus', () => {
    const bus1 = createEventBus()
    const bus2 = createEventBus()
    const handler1 = vi.fn()
    const handler2 = vi.fn()

    bus1.on('test', handler1)
    bus2.on('test', handler2)

    bus1.emit('test', {})

    expect(handler1).toHaveBeenCalled()
    expect(handler2).not.toHaveBeenCalled()
  })
})
```

### 5.5 提交代码

```bash
git add src/utils/event src/utils/__tests__/event.test.ts
git commit -m "feat(utils): add event bus utility with mitt"
```

---

## Task 6: 开发日期工具函数 (dateUtil)

**Files:**
- Create: `src/utils/dateUtil/types.ts`
- Create: `src/utils/dateUtil/format.ts`
- Create: `src/utils/dateUtil/index.ts`
- Test: `src/utils/__tests__/dateUtil.test.ts`

### 6.1 类型定义

```typescript
// src/utils/dateUtil/types.ts
import type { Dayjs, ManipulateType } from 'dayjs'

export type DateInput = string | number | Date | Dayjs

export interface DateUtilOptions {
  format?: string
  locale?: string
}
```

### 6.2 格式化函数

```typescript
// src/utils/dateUtil/format.ts
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import type { DateInput } from './types'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const DEFAULT_FORMAT = 'YYYY-MM-DD HH:mm:ss'
const DATE_FORMAT = 'YYYY-MM-DD'
const TIME_FORMAT = 'HH:mm:ss'

export function formatDate(date: DateInput, format = DEFAULT_FORMAT): string {
  return dayjs(date).format(format)
}

export function parseDate(date: DateInput): dayjs.Dayjs {
  return dayjs(date)
}

export function now(): string {
  return formatDate(new Date())
}

export function today(): string {
  return formatDate(new Date(), DATE_FORMAT)
}

export function time(): string {
  return formatDate(new Date(), TIME_FORMAT)
}

export function fromNow(date: DateInput): string {
  return dayjs(date).fromNow()
}

export function toNow(date: DateInput): string {
  return dayjs(date).toNow()
}

export function add(date: DateInput, value: number, unit: dayjs.ManipulateType): dayjs.Dayjs {
  return dayjs(date).add(value, unit)
}

export function subtract(date: DateInput, value: number, unit: dayjs.ManipulateType): dayjs.Dayjs {
  return dayjs(date).subtract(value, unit)
}

export function startOf(date: DateInput, unit: dayjs.OpUnitType): dayjs.Dayjs {
  return dayjs(date).startOf(unit)
}

export function endOf(date: DateInput, unit: dayjs.OpUnitType): dayjs.Dayjs {
  return dayjs(date).endOf(unit)
}

export function diff(date1: DateInput, date2: DateInput, unit: dayjs.QUnitType = 'millisecond'): number {
  return dayjs(date1).diff(dayjs(date2), unit)
}

export function isBefore(date1: DateInput, date2: DateInput): boolean {
  return dayjs(date1).isBefore(dayjs(date2))
}

export function isAfter(date1: DateInput, date2: DateInput): boolean {
  return dayjs(date1).isAfter(dayjs(date2))
}

export function isSame(date1: DateInput, date2: DateInput, unit?: dayjs.OpUnitType): boolean {
  return dayjs(date1).isSame(dayjs(date2), unit)
}

export function isValid(date: DateInput): boolean {
  return dayjs(date).isValid()
}

export function daysInMonth(date: DateInput): number {
  return dayjs(date).daysInMonth()
}

export function getTimestamp(date: DateInput = new Date()): number {
  return dayjs(date).valueOf()
}

export function getUnix(date: DateInput = new Date()): number {
  return dayjs(date).unix()
}
```

### 6.3 导出入口

```typescript
// src/utils/dateUtil/index.ts
export type { DateInput, DateUtilOptions } from './types'
export {
  formatDate,
  parseDate,
  now,
  today,
  time,
  fromNow,
  toNow,
  add,
  subtract,
  startOf,
  endOf,
  diff,
  isBefore,
  isAfter,
  isSame,
  isValid,
  daysInMonth,
  getTimestamp,
  getUnix,
} from './format'
```

### 6.4 单元测试

```typescript
// src/utils/__tests__/dateUtil.test.ts
import { describe, expect, it } from 'vitest'
import {
  formatDate,
  now,
  today,
  fromNow,
  add,
  subtract,
  diff,
  isBefore,
  isAfter,
  isValid,
  getTimestamp,
} from '../dateUtil'

describe('dateUtil', () => {
  it('should format date', () => {
    const date = new Date('2024-01-15 10:30:00')
    expect(formatDate(date, 'YYYY-MM-DD')).toBe('2024-01-15')
    expect(formatDate(date, 'HH:mm:ss')).toBe('10:30:00')
  })

  it('should return current date', () => {
    expect(now()).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('should return relative time', () => {
    const past = new Date(Date.now() - 3600000)
    expect(fromNow(past)).toBe('1 小时前')
  })

  it('should add and subtract time', () => {
    const date = new Date('2024-01-15')
    expect(add(date, 1, 'day').format('YYYY-MM-DD')).toBe('2024-01-16')
    expect(subtract(date, 1, 'month').format('YYYY-MM-DD')).toBe('2023-12-15')
  })

  it('should calculate diff', () => {
    const date1 = new Date('2024-01-15')
    const date2 = new Date('2024-01-10')
    expect(diff(date1, date2, 'day')).toBe(5)
  })

  it('should compare dates', () => {
    const date1 = new Date('2024-01-15')
    const date2 = new Date('2024-01-10')
    expect(isBefore(date2, date1)).toBe(true)
    expect(isAfter(date1, date2)).toBe(true)
  })

  it('should validate date', () => {
    expect(isValid('2024-01-15')).toBe(true)
    expect(isValid('invalid')).toBe(false)
  })

  it('should get timestamp', () => {
    const timestamp = getTimestamp()
    expect(typeof timestamp).toBe('number')
    expect(timestamp).toBeLessThanOrEqual(Date.now())
  })
})
```

### 6.5 提交代码

```bash
git add src/utils/dateUtil src/utils/__tests__/dateUtil.test.ts
git commit -m "feat(utils): add date utility with dayjs"
```

---

## Task 7: 开发 DOM 工具函数 (dom)

**Files:**
- Create: `src/utils/dom/types.ts`
- Create: `src/utils/dom/class.ts`
- Create: `src/utils/dom/style.ts`
- Create: `src/utils/dom/scroll.ts`
- Create: `src/utils/dom/index.ts`
- Test: `src/utils/__tests__/dom.test.ts`

### 7.1 类型定义

```typescript
// src/utils/dom/types.ts
export type DOMElement = HTMLElement | Element | null | undefined

export interface ScrollOptions {
  behavior?: ScrollBehavior
  block?: ScrollLogicalPosition
  inline?: ScrollLogicalPosition
}

export interface Position {
  x: number
  y: number
}
```

### 7.2 类名操作

```typescript
// src/utils/dom/class.ts
import type { DOMElement } from './types'

export function addClass(el: DOMElement, className: string | string[]): void {
  if (!el) return
  const classes = Array.isArray(className) ? className : [className]
  el.classList.add(...classes)
}

export function removeClass(el: DOMElement, className: string | string[]): void {
  if (!el) return
  const classes = Array.isArray(className) ? className : [className]
  el.classList.remove(...classes)
}

export function hasClass(el: DOMElement, className: string): boolean {
  if (!el) return false
  return el.classList.contains(className)
}

export function toggleClass(el: DOMElement, className: string, force?: boolean): void {
  if (!el) return
  el.classList.toggle(className, force)
}

export function replaceClass(el: DOMElement, oldClass: string, newClass: string): void {
  if (!el) return
  removeClass(el, oldClass)
  addClass(el, newClass)
}
```

### 7.3 样式操作

```typescript
// src/utils/dom/style.ts
import type { DOMElement } from './types'
import { isObject, isString } from 'es-toolkit'

export function setStyle(el: DOMElement, styles: Partial<CSSStyleDeclaration> | string, value?: string): void {
  if (!el) return

  if (isString(styles) && value) {
    el.style.setProperty(styles, value)
  } else if (isObject(styles)) {
    Object.assign(el.style, styles)
  }
}

export function getStyle(el: DOMElement, property: string): string | null {
  if (!el) return null
  return getComputedStyle(el).getPropertyValue(property)
}

export function removeStyle(el: DOMElement, property: string | string[]): void {
  if (!el) return
  const properties = Array.isArray(property) ? property : [property]
  properties.forEach(prop => el.style.removeProperty(prop))
}

export function setCssVar(el: DOMElement, name: string, value: string): void {
  if (!el) return
  el.style.setProperty(`--${name}`, value)
}

export function getCssVar(el: DOMElement, name: string): string | null {
  if (!el) return null
  return getComputedStyle(el).getPropertyValue(`--${name}`).trim()
}
```

### 7.4 滚动相关

```typescript
// src/utils/dom/scroll.ts
import type { DOMElement, ScrollOptions, Position } from './types'

export function scrollTo(el: DOMElement, options?: ScrollOptions): void {
  if (!el) return
  el.scrollIntoView(options || { behavior: 'smooth' })
}

export function scrollToTop(el: DOMElement = window as unknown as HTMLElement): void {
  if (el === window) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } else {
    (el as HTMLElement).scrollTo({ top: 0, behavior: 'smooth' })
  }
}

export function getScrollPosition(el: DOMElement = window as unknown as HTMLElement): Position {
  if (el === window) {
    return {
      x: window.scrollX || document.documentElement.scrollLeft,
      y: window.scrollY || document.documentElement.scrollTop,
    }
  }
  return {
    x: (el as HTMLElement).scrollLeft,
    y: (el as HTMLElement).scrollTop,
  }
}

export function setScrollPosition(el: DOMElement, position: Position): void {
  if (!el) return
  if (el === window) {
    window.scrollTo(position.x, position.y)
  } else {
    (el as HTMLElement).scrollLeft = position.x
    (el as HTMLElement).scrollTop = position.y
  }
}

export function isScrollable(el: DOMElement): boolean {
  if (!el) return false
  const style = getComputedStyle(el as Element)
  return /(auto|scroll)/.test(style.overflow + style.overflowY + style.overflowX)
}

export function getScrollParent(el: DOMElement): HTMLElement | null {
  if (!el) return null

  let parent = (el as Element).parentElement

  while (parent) {
    if (isScrollable(parent)) {
      return parent
    }
    parent = parent.parentElement
  }

  return document.documentElement
}
```

### 7.5 导出入口

```typescript
// src/utils/dom/index.ts
export type { DOMElement, ScrollOptions, Position } from './types'
export { addClass, removeClass, hasClass, toggleClass, replaceClass } from './class'
export { setStyle, getStyle, removeStyle, setCssVar, getCssVar } from './style'
export { scrollTo, scrollToTop, getScrollPosition, setScrollPosition, isScrollable, getScrollParent } from './scroll'
```

### 7.6 单元测试

```typescript
// src/utils/__tests__/dom.test.ts
import { describe, expect, it, beforeEach } from 'vitest'
import { addClass, removeClass, hasClass, toggleClass } from '../dom'

describe('dom', () => {
  let el: HTMLElement

  beforeEach(() => {
    el = document.createElement('div')
  })

  describe('class', () => {
    it('should add class', () => {
      addClass(el, 'test-class')
      expect(el.classList.contains('test-class')).toBe(true)
    })

    it('should add multiple classes', () => {
      addClass(el, ['class1', 'class2'])
      expect(el.classList.contains('class1')).toBe(true)
      expect(el.classList.contains('class2')).toBe(true)
    })

    it('should remove class', () => {
      el.classList.add('test-class')
      removeClass(el, 'test-class')
      expect(el.classList.contains('test-class')).toBe(false)
    })

    it('should check if has class', () => {
      el.classList.add('test-class')
      expect(hasClass(el, 'test-class')).toBe(true)
      expect(hasClass(el, 'other-class')).toBe(false)
    })

    it('should toggle class', () => {
      toggleClass(el, 'test-class')
      expect(el.classList.contains('test-class')).toBe(true)
      toggleClass(el, 'test-class')
      expect(el.classList.contains('test-class')).toBe(false)
    })
  })
})
```

### 7.7 提交代码

```bash
git add src/utils/dom src/utils/__tests__/dom.test.ts
git commit -m "feat(utils): add dom utility for class/style/scroll operations"
```

---

## Task 8: 开发 Token 管理工具 (token)

**Files:**
- Create: `src/utils/token/index.ts`
- Test: `src/utils/__tests__/token.test.ts`

### 8.1 实现 Token 管理

```typescript
// src/utils/token/index.ts
import { cache } from '../cache'
import { TOKEN_KEY } from '@/config/constants'

export interface UserInfo {
  userId: string
  username: string
  role: string
  permissions: string[]
}

export function getToken(): string | null {
  return cache.getItem<string>(TOKEN_KEY)
}

export function setToken(token: string, expire?: number): void {
  cache.setItem(TOKEN_KEY, token, expire)
}

export function removeToken(): void {
  cache.removeItem(TOKEN_KEY)
}

export function hasToken(): boolean {
  return cache.hasItem(TOKEN_KEY)
}

export function clearAuth(): void {
  removeToken()
  cache.removeItem('auth-store')
  cache.removeItem('user-info')
}
```

### 8.2 单元测试

```typescript
// src/utils/__tests__/token.test.ts
import { describe, expect, it, beforeEach } from 'vitest'
import { getToken, setToken, removeToken, hasToken, clearAuth } from '../token'
import { cache } from '../cache'

describe('token', () => {
  beforeEach(() => {
    cache.clear()
  })

  it('should set and get token', () => {
    setToken('test-token')
    expect(getToken()).toBe('test-token')
  })

  it('should remove token', () => {
    setToken('test-token')
    removeToken()
    expect(getToken()).toBeNull()
  })

  it('should check if token exists', () => {
    expect(hasToken()).toBe(false)
    setToken('test-token')
    expect(hasToken()).toBe(true)
  })

  it('should clear auth', () => {
    setToken('test-token')
    clearAuth()
    expect(getToken()).toBeNull()
  })
})
```

### 8.3 提交代码

```bash
git add src/utils/token src/utils/__tests__/token.test.ts
git commit -m "feat(utils): add token management utility"
```

---

## Task 9: 开发欢迎消息工具 (welcome)

**Files:**
- Create: `src/utils/welcome/index.ts`
- Test: `src/utils/__tests__/welcome.test.ts`

### 9.1 实现欢迎消息

```typescript
// src/utils/welcome/index.ts
import dayjs from 'dayjs'

interface WelcomeConfig {
  icon: string
  title: string
  message: string
  iconColor: string
}

const MORNING_START = 6
const NOON_START = 12
const AFTERNOON_START = 14
const EVENING_START = 18
const NIGHT_START = 22

function getTimePeriod(): 'morning' | 'noon' | 'afternoon' | 'evening' | 'night' {
  const hour = dayjs().hour()

  if (hour >= MORNING_START && hour < NOON_START) return 'morning'
  if (hour >= NOON_START && hour < AFTERNOON_START) return 'noon'
  if (hour >= AFTERNOON_START && hour < EVENING_START) return 'afternoon'
  if (hour >= EVENING_START && hour < NIGHT_START) return 'evening'
  return 'night'
}

const WELCOME_MESSAGES: Record<string, WelcomeConfig> = {
  morning: {
    icon: 'solar:sun-bold-duotone',
    title: '早上好',
    message: '新的一天，元气满满！',
    iconColor: '#ffd700',
  },
  noon: {
    icon: 'solar:sun-bold-duotone',
    title: '中午好',
    message: '记得吃午饭哦~',
    iconColor: '#ff9500',
  },
  afternoon: {
    icon: 'solar:sun-2-bold-duotone',
    title: '下午好',
    message: '下午茶时间到了',
    iconColor: '#ff6b35',
  },
  evening: {
    icon: 'solar:moon-bold-duotone',
    title: '晚上好',
    message: '忙碌了一天，辛苦了！',
    iconColor: '#6366f1',
  },
  night: {
    icon: 'solar:moon-stars-bold-duotone',
    title: '夜深了',
    message: '注意休息，早点休息~',
    iconColor: '#8b5cf6',
  },
}

export function getPersonalizedWelcome(username: string): WelcomeConfig {
  const period = getTimePeriod()
  const config = WELCOME_MESSAGES[period]

  return {
    ...config,
    message: `${username}，${config.message}`,
  }
}

export function getTimeGreeting(): string {
  const period = getTimePeriod()
  return WELCOME_MESSAGES[period].title
}
```

### 9.2 单元测试

```typescript
// src/utils/__tests__/welcome.test.ts
import { describe, expect, it } from 'vitest'
import { getPersonalizedWelcome, getTimeGreeting } from '../welcome'

describe('welcome', () => {
  it('should return personalized welcome', () => {
    const welcome = getPersonalizedWelcome('张三')
    expect(welcome.message).toContain('张三')
    expect(welcome.icon).toBeDefined()
    expect(welcome.title).toBeDefined()
  })

  it('should return time greeting', () => {
    const greeting = getTimeGreeting()
    expect(['早上好', '中午好', '下午好', '晚上好', '夜深了']).toContain(greeting)
  })
})
```

### 9.3 提交代码

```bash
git add src/utils/welcome src/utils/__tests__/welcome.test.ts
git commit -m "feat(utils): add welcome message utility"
```

---

## Task 10: 开发菜单生成工具 (helpers/menu)

**Files:**
- Create: `src/utils/helpers/menu/index.ts`
- Test: `src/utils/__tests__/menu.test.ts`

### 10.1 实现菜单生成

```typescript
// src/utils/helpers/menu/index.ts
import type { RouteRecordRaw, RouteMeta } from 'vue-router'
import { isObject } from 'es-toolkit'

interface MenuItem {
  key: string
  label: string
  icon?: string
  path: string
  children?: MenuItem[]
  hideInMenu?: boolean
  order?: number
}

interface RouteMetaExt extends RouteMeta {
  title?: string
  icon?: string
  hideInMenu?: boolean
  order?: number
}

function isRouteMeta(meta: unknown): meta is RouteMetaExt {
  return isObject(meta)
}

function sortMenus(menus: MenuItem[]): MenuItem[] {
  return menus.sort((a, b) => {
    const orderA = a.order ?? 999
    const orderB = b.order ?? 999
    return orderA - orderB
  })
}

function processRoute(route: RouteRecordRaw): MenuItem | null {
  const meta = route.meta
  if (!isRouteMeta(meta) || meta.hideInMenu) {
    return null
  }

  const name = route.name as string
  const path = route.path

  return {
    key: name,
    label: meta.title || name,
    icon: meta.icon,
    path,
    order: meta.order,
  }
}

function buildMenuTree(routes: RouteRecordRaw[], parentPath = ''): MenuItem[] {
  const menus: MenuItem[] = []

  for (const route of routes) {
    if (route.children && route.children.length > 0) {
      const menuItem = processRoute(route)
      if (menuItem) {
        menuItem.children = buildMenuTree(route.children, route.path)
        menus.push(menuItem)
      }
    } else {
      const menuItem = processRoute(route)
      if (menuItem) {
        menus.push(menuItem)
      }
    }
  }

  return sortMenus(menus)
}

export function generateMenuList(routes: RouteRecordRaw[]): MenuItem[] {
  return buildMenuTree(routes)
}

export function flattenMenus(menus: MenuItem[]): MenuItem[] {
  const result: MenuItem[] = []

  function flatten(items: MenuItem[]) {
    for (const item of items) {
      result.push(item)
      if (item.children) {
        flatten(item.children)
      }
    }
  }

  flatten(menus)
  return result
}

export function findMenuByKey(menus: MenuItem[], key: string): MenuItem | undefined {
  for (const menu of menus) {
    if (menu.key === key) return menu
    if (menu.children) {
      const found = findMenuByKey(menu.children, key)
      if (found) return found
    }
  }
  return undefined
}
```

### 10.2 单元测试

```typescript
// src/utils/__tests__/menu.test.ts
import { describe, expect, it } from 'vitest'
import { generateMenuList, flattenMenus, findMenuByKey } from '../helpers/menu'
import type { RouteRecordRaw } from 'vue-router'

describe('menu', () => {
  const mockRoutes: RouteRecordRaw[] = [
    {
      path: '/dashboard',
      name: 'dashboard',
      meta: { title: '仪表盘', icon: 'dashboard' },
      children: [
        {
          path: 'analysis',
          name: 'analysis',
          meta: { title: '分析页', icon: 'analysis' },
        } as RouteRecordRaw,
      ],
    } as RouteRecordRaw,
    {
      path: '/system',
      name: 'system',
      meta: { title: '系统管理', icon: 'setting' },
      children: [
        {
          path: 'user',
          name: 'user',
          meta: { title: '用户管理', icon: 'user' },
        } as RouteRecordRaw,
      ],
    } as RouteRecordRaw,
  ]

  it('should generate menu list', () => {
    const menus = generateMenuList(mockRoutes)
    expect(menus.length).toBe(2)
    expect(menus[0].label).toBe('仪表盘')
    expect(menus[0].children?.length).toBe(1)
  })

  it('should flatten menus', () => {
    const menus = generateMenuList(mockRoutes)
    const flattened = flattenMenus(menus)
    expect(flattened.length).toBe(4)
  })

  it('should find menu by key', () => {
    const menus = generateMenuList(mockRoutes)
    const menu = findMenuByKey(menus, 'analysis')
    expect(menu?.label).toBe('分析页')
  })
})
```

### 10.3 提交代码

```bash
git add src/utils/helpers src/utils/__tests__/menu.test.ts
git commit -m "feat(utils): add menu generation utility"
```

---

## Task 11: 开发 API 模块

**Files:**
- Create: `src/api/request.ts`
- Create: `src/api/index.ts`

### 11.1 实现 API 定义

```typescript
// src/api/request.ts
import { post, get } from '@/utils/request'
import type { Response } from '@/utils/request'

interface LoginParams {
  username: string
  password: string
}

interface LoginResponse {
  user: {
    id: string
    username: string
    token: string
    role: string
    permissions: string[]
    roles?: string[]
  }
}

interface UserInfoResponse {
  user: {
    id: string
    username: string
    role: string
    permissions: string[]
    roles?: string[]
  }
}

export function login(params: LoginParams): Promise<Response<LoginResponse>> {
  return post('/auth/login', params)
}

export function logout(): Promise<Response<null>> {
  return post('/auth/logout')
}

export function getUserInfo(): Promise<Response<UserInfoResponse>> {
  return get('/auth/user-info')
}
```

### 11.2 导出入口

```typescript
// src/api/index.ts
export * from './request'
```

### 11.3 提交代码

```bash
git add src/api
git commit -m "feat(api): add auth api module"
```

---

## Task 12: 创建工具函数统一入口

**Files:**
- Create: `src/utils/index.ts`

### 12.1 创建统一入口

```typescript
// src/utils/index.ts
export * from './cache'
export * from './cn'
export * from './crypto'
export * from './request'
export * from './event'
export * from './dateUtil'
export * from './dom'
export * from './token'
export * from './welcome'
export * from './helpers/menu'
```

### 12.2 提交代码

```bash
git add src/utils/index.ts
git commit -m "feat(utils): add unified export entry"
```

---

## Task 13: 运行测试并验证

### Step 1: 运行单元测试

```bash
bun test:unit
```

### Step 2: 运行类型检查

```bash
bun run type-check
```

### Step 3: 运行 lint

```bash
bun run lint:fix
```

### Step 4: 最终提交

```bash
git add .
git commit -m "feat: complete utility functions development for admin system"
```

---

## 文件清单汇总

| 文件路径 | 用途 |
|---------|------|
| `src/utils/cache/types.ts` | 缓存类型定义 |
| `src/utils/cache/storage.ts` | 存储适配器 |
| `src/utils/cache/memory.ts` | 内存存储 |
| `src/utils/cache/encrypt.ts` | 加密处理 |
| `src/utils/cache/index.ts` | 缓存入口 |
| `src/utils/cn/index.ts` | CSS 类名合并 |
| `src/utils/crypto/types.ts` | 加密类型定义 |
| `src/utils/crypto/hash.ts` | 哈希计算 |
| `src/utils/crypto/aes.ts` | AES/SM4 加解密 |
| `src/utils/crypto/jwt.ts` | JWT 处理 |
| `src/utils/crypto/index.ts` | 加密入口 |
| `src/utils/request/types.ts` | 请求类型定义 |
| `src/utils/request/instance.ts` | Axios 实例 |
| `src/utils/request/interceptors.ts` | 请求/响应拦截器 |
| `src/utils/request/retry.ts` | 重试机制 |
| `src/utils/request/cancel.ts` | 取消请求 |
| `src/utils/request/index.ts` | 请求入口 |
| `src/utils/event/types.ts` | 事件类型定义 |
| `src/utils/event/bus.ts` | 事件总线实现 |
| `src/utils/event/index.ts` | 事件入口 |
| `src/utils/dateUtil/types.ts` | 日期类型定义 |
| `src/utils/dateUtil/format.ts` | 日期格式化 |
| `src/utils/dateUtil/index.ts` | 日期入口 |
| `src/utils/dom/types.ts` | DOM 类型定义 |
| `src/utils/dom/class.ts` | 类名操作 |
| `src/utils/dom/style.ts` | 样式操作 |
| `src/utils/dom/scroll.ts` | 滚动相关 |
| `src/utils/dom/index.ts` | DOM 入口 |
| `src/utils/token/index.ts` | Token 管理 |
| `src/utils/welcome/index.ts` | 欢迎消息 |
| `src/utils/helpers/menu/index.ts` | 菜单生成 |
| `src/utils/index.ts` | 统一入口 |
| `src/api/request.ts` | API 定义 |
| `src/api/index.ts` | API 入口 |
| `src/utils/__tests__/*.test.ts` | 单元测试 |
