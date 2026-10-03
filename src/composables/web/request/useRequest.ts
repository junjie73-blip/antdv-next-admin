import { createEventHook, useDebounceFn, useThrottleFn } from '@vueuse/core'
import { onScopeDispose, ref, shallowRef } from 'vue'

import { RequestError } from './error'
import { executeRequest, requestCache, type ExecuteOptions } from './executor'

export interface UseRequestConfig<T = unknown> extends ExecuteOptions {
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

export function useRequest<T = unknown>(url: string | (() => string), config: UseRequestConfig<T> = {}) {
  const { immediate = true, initialData, debounce = 0, throttle = 0, updateDataOnError = false, ...execOpts } = config

  const data = shallowRef<T | undefined>(initialData)
  const loading = ref(false)
  const error = shallowRef<RequestError | null>(null)
  const status = ref<'idle' | 'loading' | 'success' | 'error'>('idle')

  const onSuccessHook = createEventHook<T>()
  const onErrorHook = createEventHook<RequestError>()
  const onFinallyHook = createEventHook<void>()

  let abortController: AbortController | null = null
  let lastMethod = 'GET'
  let lastBody: any = undefined

  const resolveUrl = () => (typeof url === 'function' ? url() : url)

  async function run(method: string, arg?: any): Promise<T> {
    lastMethod = method
    lastBody = arg
    loading.value = true
    status.value = 'loading'
    error.value = null
    abortController?.abort()
    abortController = new AbortController()
    const upper = method.toUpperCase()
    const isQueryMethod = upper === 'GET' || upper === 'HEAD' || upper === 'DELETE'
    try {
      // ⭐ 统一走 executor
      const result = await executeRequest<T>(
        upper,
        resolveUrl(),
        isQueryMethod ? undefined : arg, // GET 时 arg 是 params，不当 body
        { ...execOpts, signal: abortController.signal },
        isQueryMethod ? arg : undefined,
      )
      data.value = result
      status.value = 'success'
      onSuccessHook.trigger(result)
      config.onSuccess?.(result)
      return result
    } catch (err: any) {
      const re = err instanceof RequestError ? err : new RequestError(err?.message || '请求失败', { status: 0 })
      if (!updateDataOnError) data.value = undefined
      error.value = re
      status.value = 'error'
      onErrorHook.trigger(re)
      config.onError?.(re)
      throw re
    } finally {
      loading.value = false
      abortController = null
      onFinallyHook.trigger()
      config.onFinally?.()
    }
  }

  const rawSend = (method: string, body?: any) => run(method, body)
  const debouncedSend = debounce > 0 ? useDebounceFn(rawSend, debounce) : rawSend
  const throttledSend = throttle > 0 ? useThrottleFn(rawSend, throttle) : rawSend

  const send = (method = 'GET', body?: any) => {
    if (throttle > 0) return (throttledSend as any)(method, body)
    if (debounce > 0) return (debouncedSend as any)(method, body)
    return rawSend(method, body)
  }

  const abort = () => {
    abortController?.abort()
    abortController = null
    loading.value = false
  }
  const refresh = () => send(lastMethod, lastBody)

  if (immediate) void send('GET')
  onScopeDispose(abort)
  async function forceRefresh(): Promise<T> {
    const result = await executeRequest<T>(lastMethod, resolveUrl(), lastBody, {
      ...execOpts,
      forceRefresh: true, // ⭐ 关键
      signal: abortController?.signal,
    })
    data.value = result
    status.value = 'success'
    onSuccessHook.trigger(result)
    return result
  }

  /**
   * ⭐ 手动失效本接口的缓存（下次请求会重新拉）
   */
  function invalidate() {
    requestCache.clearByUrl(resolveUrl())
  }

  return {
    data,
    loading,
    error,
    status,
    send,
    abort,
    refresh,
    get: (p?: any) => send('GET', p),
    post: (b?: any) => send('POST', b),
    put: (b?: any) => send('PUT', b),
    patch: (b?: any) => send('PATCH', b),
    delete: (b?: any) => send('DELETE', b),
    onSuccess: onSuccessHook.on,
    onError: onErrorHook.on,
    onFinally: onFinallyHook.on,
    forceRefresh,
    invalidate,
  }
}
