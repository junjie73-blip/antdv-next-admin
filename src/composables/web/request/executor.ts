import { ErrorCode, RequestError } from './error'
import {
  createFetcher,
  forceLogout,
  isAuthEndpoint,
  isLoggingOutNow,
  refreshAccessToken,
} from './fetcher'
import { combineSignals, createTimeoutSignal } from './timeout'
import { buildUrl } from './url'

export interface ExecuteOptions {
  cache?: boolean
  cacheTime?: number
  cacheKey?: string
  forceRefresh?: boolean
  cacheOnly?: boolean
  staleWhileRevalidate?: boolean
  dedupe?: boolean
  retries?: number
  retryDelay?: number
  timeout?: number
  responseType?: 'json' | 'blob' | 'arrayBuffer' | 'text'
  signal?: AbortSignal
  /** DELETE 等少数场景需要携带请求体（后端从 req.body 读取），由 request.delete 透传 */
  body?: any
}

interface CacheEntry {
  data: any
  expireAt: number
  /** 用于 LRU 淘汰 */
  lastAccess: number
}

const cacheStore = new Map<string, CacheEntry>()
const pendingStore = new Map<string, Promise<any>>()
const MAX_CACHE_SIZE = 200

let fetcherInstance: ReturnType<typeof createFetcher> | null = null
function getFetcher() {
  if (!fetcherInstance) fetcherInstance = createFetcher()
  return fetcherInstance
}

// ============================================================
// ⭐ 缓存管理 API（供外部调用）
// ============================================================

export const requestCache = {
  /** 清空所有缓存 */
  clear: () => cacheStore.clear(),

  /** 按完整 key 删除 */
  delete: (key: string) => cacheStore.delete(key),

  /** 按 URL 清除（同一接口所有参数组合） */
  clearByUrl: (url: string) => {
    for (const key of cacheStore.keys()) {
      if (key.includes(`:${url}:`)) cacheStore.delete(key)
    }
  },

  /** 按正则清除 */
  clearByPattern: (pattern: RegExp) => {
    for (const key of cacheStore.keys()) {
      if (pattern.test(key)) cacheStore.delete(key)
    }
  },

  /** 查询是否命中（不触发请求） */
  has: (key: string): boolean => {
    const entry = cacheStore.get(key)
    if (!entry) return false
    if (entry.expireAt < Date.now()) {
      cacheStore.delete(key)
      return false
    }
    return true
  },

  /** 手动读缓存 */
  get: <T = any>(key: string): T | undefined => {
    const entry = cacheStore.get(key)
    if (!entry || entry.expireAt < Date.now()) {
      cacheStore.delete(key)
      return undefined
    }
    entry.lastAccess = Date.now()
    return entry.data as T
  },

  /** 手动写缓存 */
  set: (key: string, data: any, cacheTime = 5 * 60 * 1000) => {
    cacheStore.set(key, {
      data,
      expireAt: Date.now() + cacheTime,
      lastAccess: Date.now(),
    })
    evictIfNeeded()
  },

  /** 当前缓存条目数 */
  size: () => cacheStore.size,
}

// ============================================================
// 内部工具
// ============================================================

function cleanExpiredCache() {
  const now = Date.now()
  for (const [k, v] of cacheStore) if (v.expireAt < now) cacheStore.delete(k)
}

/** ⭐ LRU 淘汰：超出上限时删最久未访问的 */
function evictIfNeeded() {
  if (cacheStore.size <= MAX_CACHE_SIZE) return
  // Map 保持插入顺序；用 lastAccess 排序找最旧的
  const entries = [...cacheStore.entries()].sort(
    (a, b) => a[1].lastAccess - b[1].lastAccess,
  )
  const removeCount = cacheStore.size - MAX_CACHE_SIZE
  for (let i = 0; i < removeCount; i++) cacheStore.delete(entries[i]![0])
}

function isRetryable(err: unknown): boolean {
  if (err instanceof RequestError) {
    if ([400001, 401001, 403001, 404001].includes(err.code)) return false
    if (err.status === 0) return true
    return err.status >= 500 || err.code >= 500000
  }
  return err instanceof TypeError
}

/** 判断是否已是 fetch 可直接消费的 BodyInit（FormData / Blob / URLSearchParams / 二进制 / 流） */
function isBodyInit(body: unknown): boolean {
  if (typeof body === 'string') return true
  if (typeof FormData !== 'undefined' && body instanceof FormData) return true
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams)
    return true
  if (typeof Blob !== 'undefined' && body instanceof Blob) return true
  if (
    typeof ArrayBuffer !== 'undefined' &&
    (body instanceof ArrayBuffer || ArrayBuffer.isView(body))
  )
    return true
  if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream)
    return true
  return false
}

/** 只对普通对象做 JSON 序列化：统一 stringify 会把 FormData 打成 "{}"，导致上传内容丢失 */
function normalizeBody(body: unknown): BodyInit | undefined {
  if (body === undefined || body === null) return undefined
  if (isBodyInit(body)) return body as BodyInit
  return JSON.stringify(body)
}

async function doOnce<T>(
  method: string,
  url: string,
  body: any,
  opts: ExecuteOptions,
): Promise<T> {
  const { timeout = 30000, signal: externalSignal } = opts
  const timeoutCtl = createTimeoutSignal(timeout)
  const combined = combineSignals([externalSignal, timeoutCtl.signal])
  const requestInit: RequestInit = {
    method,
    body: normalizeBody(body),
    signal: combined.signal,
  }
  const useFetchOptions = {}
  const fetcher = getFetcher()

  let res: any
  switch (opts.responseType) {
    case 'blob':
      res = await fetcher(url, requestInit, useFetchOptions).blob()
      break
    case 'arrayBuffer':
      res = await fetcher(url, requestInit, useFetchOptions).arrayBuffer()
      break
    case 'text':
      res = await fetcher(url, requestInit, useFetchOptions).text()
      break
    default:
      res = await fetcher(url, requestInit, useFetchOptions)
  }

  if (res.error?.value) {
    const e = res.error.value
    if (timeoutCtl.didTimeout()) {
      throw new RequestError('请求超时，请稍后重试', {
        status: 408,
        statusText: 'Request Timeout',
        code: 408,
      })
    }
    throw e instanceof RequestError
      ? e
      : new RequestError((e as any)?.message || '请求失败', {
          status: (e as any)?.status ?? 0,
          data: res.data?.value,
        })
  }
  return res.data?.value as T
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number,
  retryDelay: number,
): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (i === retries || !isRetryable(err)) throw err
      await new Promise<void>((r) =>
        setTimeout(
          r,
          Math.min(retryDelay * 2 ** i + Math.random() * 200, 10000),
        ),
      )
    }
  }
  throw lastErr
}

/**
 * 收到 401 时先尝试刷新令牌并重放一次；
 * 认证接口自身、已在登出流程中、或已重放过的情况直接抛出，避免死循环。
 */
async function doOnceWithAuthReplay<T>(
  method: string,
  url: string,
  body: any,
  opts: ExecuteOptions,
  retried = false,
): Promise<T> {
  try {
    return await doOnce<T>(method, url, body, opts)
  } catch (err) {
    const unauthorized =
      err instanceof RequestError &&
      (err.status === 401 || err.code === ErrorCode.UNAUTHORIZED)
    if (!unauthorized || retried || isAuthEndpoint(url) || isLoggingOutNow())
      throw err
    try {
      await refreshAccessToken()
    } catch {
      forceLogout()
      throw err
    }
    return await doOnceWithAuthReplay<T>(method, url, body, opts, true)
  }
}

// ============================================================
// 主入口
// ============================================================

export async function executeRequest<T = any>(
  method: string,
  url: string,
  body?: any,
  opts: ExecuteOptions = {},
  params?: Record<string, any>,
): Promise<T> {
  const {
    cache: enableCache = false,
    cacheTime = 5 * 60 * 1000,
    cacheKey: customKey,
    forceRefresh = false,
    cacheOnly = false,
    staleWhileRevalidate = false,
    dedupe = true,
  } = opts

  const finalMethod = method.toUpperCase()
  const finalUrl = params ? buildUrl(url, params) : url
  // 流式 body（FormData/Blob/流）无法稳定序列化成 key，用占位符并关闭并发去重
  const streamBody = isBodyInit(body) && typeof body !== 'string'
  const cacheKey =
    customKey ??
    `${finalMethod}:${finalUrl}:${streamBody ? '[stream]' : JSON.stringify(body ?? '')}`
  const canCache = enableCache && finalMethod === 'GET'
  const canDedupe = dedupe && !streamBody

  // ---------- 1) 缓存读 ----------
  if (canCache && !forceRefresh) {
    cleanExpiredCache()
    const cached = cacheStore.get(cacheKey)
    if (cached && cached.expireAt > Date.now()) {
      cached.lastAccess = Date.now()

      // ⭐ SWR：立即返回旧值，后台静默刷新
      if (staleWhileRevalidate) {
        // 不 await，静默后台更新
        void runRequest<T>(
          finalMethod,
          finalUrl,
          body,
          opts,
          cacheKey,
          cacheTime,
        ).catch(() => {
          /* 后台失败静默 */
        })
      }
      return cached.data
    }
    // ⭐ 只读缓存模式
    if (cacheOnly) {
      throw new RequestError('缓存未命中', { status: 0, code: -1 })
    }
  }

  // ---------- 2) 去重 ----------
  if (canDedupe && pendingStore.has(cacheKey)) {
    return pendingStore.get(cacheKey)!
  }

  // ---------- 3) 执行 ----------
  const promise = runRequest<T>(
    finalMethod,
    finalUrl,
    body,
    opts,
    cacheKey,
    cacheTime,
  )
  if (canDedupe) pendingStore.set(cacheKey, promise)

  try {
    return await promise
  } finally {
    if (canDedupe) pendingStore.delete(cacheKey)
  }
}

/** 抽出来的核心执行逻辑，SWR 后台刷新也复用它 */
function runRequest<T>(
  method: string,
  url: string,
  body: any,
  opts: ExecuteOptions,
  cacheKey: string,
  cacheTime: number,
): Promise<T> {
  const { cache: enableCache = false, retries = 3, retryDelay = 300 } = opts
  const canCache = enableCache && method === 'GET'

  return withRetry(
    () => doOnceWithAuthReplay<T>(method, url, body, opts),
    retries,
    retryDelay,
  ).then((result) => {
    if (canCache) {
      cacheStore.set(cacheKey, {
        data: result,
        expireAt: Date.now() + cacheTime,
        lastAccess: Date.now(),
      })
      evictIfNeeded()
    }
    return result
  })
}
