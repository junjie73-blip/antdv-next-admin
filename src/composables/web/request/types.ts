import type { EventHook } from '@vueuse/core'
import type { Ref } from 'vue'

import type { RequestError } from './error'
export interface ApiResponse<T = unknown> {
  code: number
  message?: string
  timestamp?: number
  data?: T
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD'

export interface UseRequestConfig<T = unknown> {
  /** 是否立即发起请求，默认 true */
  immediate?: boolean
  /** 初始 data 值 */
  initialData?: T
  /** 是否开启 GET 缓存 */
  cache?: boolean
  /** 缓存过期时间（ms），默认 5 分钟 */
  cacheTime?: number
  /** 是否开启请求去重（同一请求进行中时复用 Promise） */
  dedupe?: boolean
  /** 失败重试次数，默认 3 */
  retries?: number
  /** 重试基础延迟（ms），默认 300 */
  retryDelay?: number
  /** 防抖等待时间（ms），0 表示不防抖 */
  debounce?: number
  /** 节流等待时间（ms），0 表示不节流 */
  throttle?: number
  /** 请求超时（ms） */
  timeout?: number
  /** 响应类型：json（默认）/ blob / arrayBuffer / text */
  responseType?: 'json' | 'blob' | 'arrayBuffer' | 'text'
  /** 是否在错误时也更新 data（用于保留旧数据） */
  updateDataOnError?: boolean
  /** 成功回调 */
  onSuccess?: (data: T) => void
  /** 错误回调 */
  onError?: (error: RequestError) => void
  /** 完成回调（无论成功失败） */
  onFinally?: () => void
}

export interface UseRequestReturn<T = unknown> {
  data: Ref<T | undefined>
  loading: Ref<boolean>
  error: Ref<RequestError | null>
  status: Ref<'idle' | 'loading' | 'success' | 'error'>
  /** 手动发送请求 */
  send: (...args: any[]) => Promise<T>
  /** 取消当前请求 */
  abort: () => void
  /** 重新执行最近一次请求 */
  refresh: () => Promise<T>
  /** 事件订阅 */
  onSuccess: EventHook<T>['on']
  onError: EventHook<RequestError>['on']
  onFinally: EventHook<void>['on']
}
