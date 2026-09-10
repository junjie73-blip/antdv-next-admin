import type { RequestMeta } from './interface'
import { createAlova } from 'alova'
import adapterFetch from 'alova/fetch'
import VueHook from 'alova/vue'

import { useUserStore } from '@/stores/modules/user'
import { config as csrfConfig, getCsrfToken, initCsrfProtection } from '@/utils/csrf'
import { AUTHORIZATION_KEY } from './constant'
import { message } from 'antdv-next'

interface CreateRequestClientOptions {
  /** 自定义 fetch 实现 */
  customFetch?: typeof fetch
  /** 基础 URL，默认取环境变量 VITE_APP_BASE_API */
  baseURL?: string
  /** 最大重试次数（默认 3） */
  maxRetries?: number
  /** 是否启用 GET 缓存（默认 false） */
  enableCache?: boolean
  /** GET 缓存过期时间（毫秒，默认 5 分钟） */
  cacheExpireTime?: number
  /** 请求超时时间（毫秒，默认 30000） */
  timeout?: number
}

class AlovaRequestError<T = unknown> extends Error {
  data?: T
  status: number
  statusText: string
  retryCount: number

  constructor(
    message: string,
    options: {
      data?: T
      status: number
      statusText: string
      retryCount?: number
    },
  ) {
    super(message)
    this.name = 'RequestError'
    this.data = options.data
    this.status = options.status
    this.statusText = options.statusText
    this.retryCount = options.retryCount ?? 0
  }
}

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504])
const CACHEABLE_METHODS = new Set(['GET', 'HEAD'])
const pendingRequests = new Map<string, Promise<any>>()

let csrfInitialized = false

export function createRequestClient(options: CreateRequestClientOptions = {}) {
  const {
    customFetch,
    baseURL = import.meta.env.VITE_APP_BASE_API || '',
    maxRetries = 3,
    enableCache = false,
    cacheExpireTime = 5 * 60 * 1000,
    timeout = 30000,
  } = options

  // 创建 fetch 适配器，并传入自定义 fetch
  const fetchAdapter = adapterFetch({
    customFetch,
  })

  return createAlova({
    baseURL,
    requestAdapter: fetchAdapter,
    shareRequest: true,
    statesHook: VueHook,
    timeout, // 全局请求超时

    async beforeRequest(method) {
      // CSRF 初始化
      if (!csrfInitialized) {
        initCsrfProtection({
          headerName: 'X-CSRF-Token',
          doubleSubmit: true,
          autoRotate: true,
        })
        csrfInitialized = true
      }

      // Authorization Token
      if (method.config.meta?.token !== false) {
        const userStore = useUserStore()
        if (userStore.token) {
          method.config.headers = {
            ...method.config.headers,
            [AUTHORIZATION_KEY]: `Bearer ${userStore.token}`,
          }
        }
      }

      // CSRF Token（状态修改请求）
      const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE']
      const methodType = (method.type as string).toUpperCase()

      if (stateChangingMethods.includes(methodType)) {
        try {
          const csrfToken = await getCsrfToken()
          if (csrfToken?.value) {
            method.config.headers = {
              ...method.config.headers,
              [csrfConfig.headerName]: csrfToken.value,
            }
          }
        } catch {
          console.warn('[Security] CSRF Token 获取失败，继续请求')
        }
      }
      const isFormData = method.data instanceof FormData

      // 安全头设置
      method.config.headers = {
        ...method.config.headers,
        'Content-Type': isFormData
          ? undefined // 让浏览器自动设置（含 boundary）
          : method.config.headers?.['Content-Type'] || 'application/json; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        ...(stateChangingMethods.includes(methodType)
          ? { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
          : {}),
      }

      // 请求去重（仅对写操作）
      if (!CACHEABLE_METHODS.has(method.type as string)) {
        const requestKey = getRequestKey(method)
        if (pendingRequests.has(requestKey)) {
          method.response = () => pendingRequests.get(requestKey)!
        } else {
          const originalResponse = method.response
          if (originalResponse) {
            const requestPromise = originalResponse().finally(() => {
              clearPendingRequest(method)
            })
            pendingRequests.set(requestKey, requestPromise)
            method.response = () => requestPromise
          }
        }
      }

      // GET 缓存
      if (enableCache && CACHEABLE_METHODS.has(method.type as string)) {
        method.config.cacheFor = {
          mode: 'memory',
          expire: cacheExpireTime,
          tag: method.url + JSON.stringify(method.params ?? {}),
        }
      }
    },

    responded: {
      async onSuccess(response) {
        const contentType = response.headers.get('content-type') ?? ''
        let payload: unknown
        if (contentType.includes('application/json')) {
          payload = await response.json()
        } else {
          const text = await response.clone().text()
          try {
            payload = JSON.parse(text)
          } catch {
            payload = await response.text()
          }
        }

        if (!response.ok) {
          const requestError = new AlovaRequestError(
            resolveErrorMessage(payload, `${response.status} ${response.statusText}`),
            { data: payload, status: response.status, statusText: response.statusText },
          )
          await reportRequestError(requestError)
          throw requestError
        }

        return payload
      },

      async onError(error, method) {
        clearPendingRequest(method)

        const shouldRetry = getRetryConfig(error, method, maxRetries)
        if (shouldRetry.shouldRetry) {
          console.warn(
            `[API] 请求失败，正在重试 (${shouldRetry.currentAttempt}/${maxRetries})...`,
            method.url,
          )
          await delay(calculateBackoff(shouldRetry.currentAttempt))
          try {
            return await method.send()
          } catch (retryError) {
            await reportRequestError(retryError)
            throw retryError
          }
        }

        await reportRequestError(error)
        throw error
      },
    },
  })
}

// 辅助函数（保持不变）
function getRequestKey(method: any): string {
  return [
    method.type,
    method.url,
    JSON.stringify(method.params ?? {}),
    JSON.stringify(method.data ?? {}),
  ].join(':')
}

function clearPendingRequest(method: any): void {
  const requestKey = getRequestKey(method)
  pendingRequests.delete(requestKey)
}

function calculateBackoff(attempt: number, baseDelay = 300): number {
  const exponentialDelay = baseDelay * 2 ** attempt
  const jitter = Math.random() * 200
  return Math.min(exponentialDelay + jitter, 10000)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getRetryConfig(
  error: any,
  method: any,
  maxRetries: number,
): { shouldRetry: boolean; currentAttempt: number } {
  const currentAttempt = error instanceof AlovaRequestError ? error.retryCount + 1 : 1
  if (currentAttempt > maxRetries) return { shouldRetry: false, currentAttempt }
  if (error instanceof AlovaRequestError) {
    if (RETRYABLE_STATUS_CODES.has(error.status)) return { shouldRetry: true, currentAttempt }
    if (error.status === 0) return { shouldRetry: true, currentAttempt }
  }
  if (error instanceof TypeError) return { shouldRetry: true, currentAttempt }
  return { shouldRetry: false, currentAttempt }
}

async function reportRequestError(error: unknown) {
  if (error instanceof AlovaRequestError) {
    message.error(resolveErrorMessage(error.data, error.message))
    return
  }
  if (error instanceof Error) {
    message.error(error.message || '服务器错误')
    return
  }
  message.error('服务器错误')
}

function resolveErrorMessage(data: unknown, fallback: string) {
  if (typeof data === 'object' && data !== null && 'msg' in data && typeof data.msg === 'string') {
    return data.msg
  }
  return fallback
}

export const http = createRequestClient()
export type { RequestMeta }
export { AlovaRequestError as RequestError }
