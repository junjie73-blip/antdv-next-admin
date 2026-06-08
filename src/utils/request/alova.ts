import type { MockWrapper } from '@alova/mock'
import type { RequestMeta } from './interface'
import { createAlovaMockAdapter } from '@alova/mock'
import { createAlova } from 'alova'
import adapterFetch from 'alova/fetch'
import VueHook from 'alova/vue'

import { useUserStore } from '@/stores/modules/user'
// 安全相关导入
import { config as csrfConfig, getCsrfToken, initCsrfProtection } from '@/utils/csrf'
import authMock from '../../../mock/auth'
import deptMock from '../../../mock/dept'
import dictMock from '../../../mock/dict'
import fileMock from '../../../mock/file'
import logMock from '../../../mock/log'
import loginMock from '../../../mock/login'
import loginLogMock from '../../../mock/login-log'
import menuMock from '../../../mock/menu'
import noticeMock from '../../../mock/notice'
import onlineMock from '../../../mock/online'
import postMock from '../../../mock/post'
import roleMock from '../../../mock/role'
import settingsMock from '../../../mock/settings'
import tableMock from '../../../mock/table'
import userMock from '../../../mock/user'
import { AUTHORIZATION_KEY } from './constant'

interface CreateRequestClientOptions {
  customFetch?: typeof fetch
  /** 最大重试次数（默认 3） */
  maxRetries?: number
  /** 是否启用 GET 缓存（默认 true） */
  enableCache?: boolean
  /** GET 缓存过期时间（毫秒，默认 5 分钟） */
  cacheExpireTime?: number
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

/** 可重试的 HTTP 状态码 */
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504])

/** 可缓存的请求方法 */
const CACHEABLE_METHODS = new Set(['GET', 'HEAD'])

/** 正在进行中的请求 Map（用于去重） */
const pendingRequests = new Map<string, Promise<any>>()

const isMockEnabled = import.meta.env.VITE_MOCK === 'true'

export function createRequestClient(options: CreateRequestClientOptions = {}) {
  const {
    customFetch,
    maxRetries = 3,
    enableCache = true,
    cacheExpireTime = 5 * 60 * 1000, // 5 分钟
  } = options

  const fetchAdapter = adapterFetch({
    customFetch,
  })

  const mockWrappers: MockWrapper[] = [
    authMock,
    loginMock,
    menuMock,
    tableMock,
    userMock,
    deptMock,
    loginLogMock,
    postMock,
    fileMock,
    settingsMock,
    dictMock,
    logMock,
    onlineMock,
    noticeMock,
    roleMock,
  ]

  const mockAdapter = createAlovaMockAdapter(mockWrappers, {
    enable: isMockEnabled,
    httpAdapter: fetchAdapter,
    matchMode: 'methodurl',
    delay: [200, 500],
    mockRequestLogger: isMockEnabled,
  })

  return createAlova({
    baseURL: import.meta.env.VITE_APP_BASE_API || '',
    requestAdapter: mockAdapter,
    shareRequest: true,
    statesHook: VueHook,

    /**
     * 请求前拦截器
     * - 自动添加 Authorization Token
     * - 自动添加 CSRF Token（状态修改请求）
     * - 安全头设置
     * - 请求去重处理
     */
    async beforeRequest(method) {
      // ==================== 初始化 CSRF 防护 ====================
      // 确保 CSRF 系统已初始化
      if (!csrfConfig.tokenKey) {
        initCsrfProtection({
          headerName: 'X-CSRF-Token',
          doubleSubmit: true,
          autoRotate: true,
        })
      }

      // ==================== Authorization Token 处理 ====================
      if (method.config.meta?.token !== false) {
        const userStore = useUserStore()
        if (userStore.token) {
          method.config.headers = {
            ...(method.config.headers ?? {}),
            [AUTHORIZATION_KEY]: `Bearer ${userStore.token}`,
          }
        }
      }

      // ==================== CSRF Token 处理 ====================
      // 仅对状态修改方法（POST/PUT/PATCH/DELETE）添加 CSRF Token
      const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE']
      const methodType = (method.type as string).toUpperCase()

      if (stateChangingMethods.includes(methodType)) {
        try {
          const csrfToken = await getCsrfToken()
          if (csrfToken?.value) {
            method.config.headers = {
              ...(method.config.headers ?? {}),
              [csrfConfig.headerName]: csrfToken.value,
            }
          }
        }
        catch {
          console.warn('[Security] CSRF Token 获取失败，继续请求')
        }
      }

      // ==================== 安全头设置 ====================
      method.config.headers = {
        ...(method.config.headers ?? {}),

        // Content-Type 安全：防止 MIME 嗅探攻击
        'Content-Type': method.config.headers?.['Content-Type']
          || 'application/json; charset=utf-8',

        // X-Content-Type-Options: 防止 MIME 嗅探（仅服务端返回时有效，客户端发送无影响）
        'X-Content-Type-Options': 'nosniff',

        // X-Frame-Options: 防止点击劫持
        'X-Frame-Options': 'DENY',

        // X-XSS-Protection: 浏览器 XSS 过滤器（现代浏览器已内置）
        'X-XSS-Protection': '1; mode=block',

        // Referrer-Policy: 控制 Referer 头泄露
        'Referrer-Policy': 'strict-origin-when-cross-origin',

        // Cache-Control: 敏感操作不缓存
        ...(
          stateChangingMethods.includes(methodType)
            ? { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
            : {}
        ),
      }

      // POST/PUT/PATCH 请求去重（防止重复提交）
      if (!CACHEABLE_METHODS.has(method.type as string)) {
        const requestKey = getRequestKey(method)
        if (pendingRequests.has(requestKey)) {
          // 返回已存在的请求，实现去重
          method.response = () => pendingRequests.get(requestKey)!
        }
      }

      // GET 请求缓存配置
      if (enableCache && CACHEABLE_METHODS.has(method.type as string)) {
        method.config.cacheFor = {
          mode: 'memory',
          expire: cacheExpireTime,
          tag: method.url + JSON.stringify(method.params ?? {}),
        }
      }
    },

    responded: {
      /**
       * 成功响应处理
       * - 错误状态码转抛异常
       * - 清理去重缓存
       */
      async onSuccess(response) {
        const contentType = response.headers.get('content-type') ?? ''

        let payload: unknown
        if (contentType.includes('application/json')) {
          payload = await response.json()
        }
        else {
          const text = await response.clone().text()
          try {
            payload = JSON.parse(text)
          }
          catch {
            payload = await response.text()
          }
        }

        if (!response.ok) {
          const requestError = new AlovaRequestError(
            resolveErrorMessage(payload, `${response.status} ${response.statusText}`),
            {
              data: payload,
              status: response.status,
              statusText: response.statusText,
            },
          )
          await reportRequestError(requestError)
          throw requestError
        }

        return payload
      },

      /**
       * 错误响应处理
       * - 自动重试可恢复错误
       * - 上报错误信息
       */
      async onError(error, method) {
        // 清理去重缓存
        clearPendingRequest(method)

        // 判断是否需要重试
        const shouldRetry = getRetryConfig(error, method, maxRetries)

        if (shouldRetry.shouldRetry) {
          console.warn(
            `[API] 请求失败，正在重试 (${shouldRetry.currentAttempt}/${maxRetries})...`,
            method.url,
          )

          // 等待一段时间后重试（指数退避）
          await delay(calculateBackoff(shouldRetry.currentAttempt))

          try {
            return await method.send()
          }
          catch (retryError) {
            // 重试也失败了，上报最终错误
            await reportRequestError(retryError)
            throw retryError
          }
        }

        // 不重试，直接上报错误
        await reportRequestError(error)
        throw error
      },
    },
  })
}

/**
 * 获取请求唯一标识（用于去重）
 */
function getRequestKey(method: any): string {
  return [
    method.type,
    method.url,
    JSON.stringify(method.params ?? {}),
    JSON.stringify(method.data ?? {}),
  ].join(':')
}

/**
 * 清理去重缓存
 */
function clearPendingRequest(method: any): void {
  const requestKey = getRequestKey(method)
  pendingRequests.delete(requestKey)
}

/**
 * 计算指数退避延迟时间
 * 公式：baseDelay * 2^attempt + random jitter
 */
function calculateBackoff(attempt: number, baseDelay = 300): number {
  const exponentialDelay = baseDelay * 2 ** attempt
  const jitter = Math.random() * 200 // 随机抖动 0-200ms
  return Math.min(exponentialDelay + jitter, 10000) // 最大 10 秒
}

/**
 * 延迟工具函数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 判断是否应该重试请求
 */
function getRetryConfig(error: any, method: any, maxRetries: number): {
  shouldRetry: boolean
  currentAttempt: number
} {
  // 从错误对象中获取当前重试次数
  const currentAttempt = error instanceof AlovaRequestError
    ? error.retryCount + 1
    : 1

  // 检查是否超过最大重试次数
  if (currentAttempt > maxRetries) {
    return { shouldRetry: false, currentAttempt }
  }

  // 检查错误类型是否支持重试
  if (error instanceof AlovaRequestError) {
    // 只对特定状态码重试
    if (RETRYABLE_STATUS_CODES.has(error.status)) {
      return { shouldRetry: true, currentAttempt }
    }

    // 网络错误（status 为 0 通常表示网络问题）
    if (error.status === 0) {
      return { shouldRetry: true, currentAttempt }
    }
  }

  // TypeError 通常是网络错误（如断网、DNS 解析失败）
  if (error instanceof TypeError) {
    return { shouldRetry: true, currentAttempt }
  }

  return { shouldRetry: false, currentAttempt }
}

export const http = createRequestClient()

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

export type { RequestMeta }
export { AlovaRequestError as RequestError }
