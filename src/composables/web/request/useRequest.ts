import { createEventHook, useDebounceFn, useThrottleFn } from '@vueuse/core'
import { ref, shallowRef, onScopeDispose } from 'vue'

import type { UseRequestConfig, UseRequestReturn } from './types'

import { RequestError } from './error'
import { createFetcher } from './fetcher'

// —— 全局缓存 & 去重 ——
const cacheStore = new Map<string, { data: any; expireAt: number }>()
const pendingStore = new Map<string, Promise<any>>()

function getCacheKey(method: string, url: string, body?: any) {
  return `${method}:${url}:${JSON.stringify(body ?? '')}`
}
function cleanExpiredCache() {
  const now = Date.now()
  for (const [k, v] of cacheStore) if (v.expireAt < now) cacheStore.delete(k)
}

export function useRequest<T = unknown>(
  url: string | (() => string),
  config: UseRequestConfig<T> = {},
): UseRequestReturn<T> {
  const {
    immediate = true,
    initialData,
    cache: enableCache = false,
    cacheTime = 5 * 60 * 1000,
    dedupe = true,
    retries = 3,
    retryDelay = 300, // ⭐ 现在真的用上了
    debounce = 0,
    throttle = 0,
    timeout = 30000,
    responseType = 'json',
    updateDataOnError = false,
    onSuccess: onSuccessCb,
    onError: onErrorCb,
    onFinally: onFinallyCb,
  } = config

  const fetcher = createFetcher({ timeout })

  const data = shallowRef<T | undefined>(initialData)
  const loading = ref(false)
  // ⭐ 显式声明类型，解决 "ShallowRef<any> 上不存在 message"
  const error = shallowRef<RequestError | null>(null)
  const status = ref<'idle' | 'loading' | 'success' | 'error'>('idle')

  const onSuccessHook = createEventHook<T>()
  const onErrorHook = createEventHook<RequestError>()
  const onFinallyHook = createEventHook<void>()

  let abortController: AbortController | null = null
  let lastMethod = 'GET'
  let lastBody: any = undefined

  function resolveUrl() {
    return typeof url === 'function' ? url() : url
  }

  function isRetryable(err: unknown): boolean {
    if (err instanceof RequestError) {
      if ([400001, 401001, 403001, 404001].includes(err.code)) return false
      if (err.status === 0) return true
      return err.status >= 500 || err.code >= 500000
    }
    return err instanceof TypeError
  }

  function withRetry(fn: () => Promise<T>, retriesLeft: number): Promise<T> {
    return fn().catch((err) => {
      if (retriesLeft <= 0 || !isRetryable(err)) throw err
      const attempt = retries - retriesLeft + 1
      // ⭐ 使用 retryDelay
      const delay = Math.min(retryDelay * 2 ** attempt + Math.random() * 200, 10000)
      return new Promise<void>((r) => setTimeout(r, delay)).then(() => withRetry(fn, retriesLeft - 1))
    })
  }

  async function execute(method: string, body?: any): Promise<T> {
    const finalUrl = resolveUrl()
    const finalMethod = method.toUpperCase()
    const cacheKey = getCacheKey(finalMethod, finalUrl, body)

    // —— 去重 ——
    if (dedupe && pendingStore.has(cacheKey)) {
      return pendingStore.get(cacheKey)!
    }

    // —— GET 缓存 ——
    if (enableCache && finalMethod === 'GET') {
      cleanExpiredCache()
      const cached = cacheStore.get(cacheKey)
      if (cached && cached.expireAt > Date.now()) {
        data.value = cached.data
        status.value = 'success'
        onSuccessHook.trigger(cached.data)
        onFinallyHook.trigger()
        return cached.data
      }
    }

    const promise = (async (): Promise<T> => {
      loading.value = true
      status.value = 'loading'
      error.value = null

      const controller = new AbortController()
      abortController = controller

      try {
        // ⭐ 关键修复：RequestInit 放第 2 参，UseFetchOptions 放第 3 参
        const requestInit: RequestInit = {
          method: finalMethod,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        }
        const useFetchOptions = { timeout }

        // ⭐ 根据 responseType 选择解析方法；返回值是 UseFetchReturn
        let res: any
        if (responseType === 'blob') {
          res = await fetcher(finalUrl, requestInit, useFetchOptions).blob()
        } else if (responseType === 'arrayBuffer') {
          res = await fetcher(finalUrl, requestInit, useFetchOptions).arrayBuffer()
        } else if (responseType === 'text') {
          res = await fetcher(finalUrl, requestInit, useFetchOptions).text()
        } else {
          res = await fetcher(finalUrl, requestInit, useFetchOptions)
        }

        // ⭐ error.value 由 useFetch 提供
        if (res.error?.value) {
          const e = res.error.value
          const wrapped =
            e instanceof RequestError
              ? e
              : new RequestError((e as any)?.message || '请求失败', {
                  status: (e as any)?.status ?? 0,
                  data: res.data?.value,
                })
          throw wrapped
        }

        const result = res.data?.value as T
        data.value = result
        status.value = 'success'
        onSuccessHook.trigger(result)
        onSuccessCb?.(result)

        if (enableCache && finalMethod === 'GET') {
          cacheStore.set(cacheKey, { data: result, expireAt: Date.now() + cacheTime })
        }
        return result
      } catch (err: any) {
        const requestError =
          err instanceof RequestError ? err : new RequestError(err?.message || '请求失败', { status: 0 })

        if (!updateDataOnError) data.value = undefined
        error.value = requestError
        status.value = 'error'
        onErrorHook.trigger(requestError)
        onErrorCb?.(requestError)
        throw requestError
      } finally {
        loading.value = false
        abortController = null
        onFinallyHook.trigger()
        onFinallyCb?.()
        pendingStore.delete(cacheKey)
      }
    })()

    if (dedupe) pendingStore.set(cacheKey, promise)
    return promise
  }

  const rawSend = (method: string, body?: any) => {
    lastMethod = method
    lastBody = body
    return withRetry(() => execute(method, body), retries)
  }
  const debouncedSend = debounce > 0 ? useDebounceFn(rawSend, debounce) : rawSend
  const throttledSend = throttle > 0 ? useThrottleFn(rawSend, throttle) : rawSend
  const send = (method = 'GET', body?: any) => {
    if (throttle > 0) return (throttledSend as any)(method, body)
    if (debounce > 0) return (debouncedSend as any)(method, body)
    return rawSend(method, body)
  }

  function abort() {
    abortController?.abort()
    abortController = null
    loading.value = false
  }
  function refresh() {
    return send(lastMethod, lastBody)
  }

  const get = (params?: any) => send('GET', params)
  const post = (body?: any) => send('POST', body)
  const put = (body?: any) => send('PUT', body)
  const patch = (body?: any) => send('PATCH', body)
  const del = (body?: any) => send('DELETE', body)

  if (immediate) get()
  onScopeDispose(abort)

  return {
    data: data as any,
    loading,
    error,
    status,
    send,
    abort,
    refresh,
    onSuccess: onSuccessHook.on,
    onError: onErrorHook.on,
    onFinally: onFinallyHook.on,
    get,
    post,
    put,
    patch,
    delete: del,
  } as any
}
