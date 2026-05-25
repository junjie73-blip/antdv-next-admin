import type { CreateLoadingOptions, LoadingInstance } from './types'
import { useLoading } from './useLoading'

/**
 * createLoading - 函数式创建 loading
 * 用于在任意位置（包括组件外）创建 loading 实例
 *
 * @example
 * // 在路由守卫中使用
 * import { createLoading } from '@/components/Loading'
 *
 * const loading = createLoading({
 *   tip: '页面初始化...',
 *   theme: 'dark',
 *   background: 'rgba(0,0,0,0.8)'
 * })
 *
 * loading.open()
 * await initApp()
 * loading.close()
 *
 * @example
 * // 在请求拦截器中使用
 * let requestLoading: LoadingInstance | null = null
 *
 * request.interceptors.request.use((config) => {
 *   requestLoading = createLoading({ tip: '请求中...' })
 *   requestLoading.open()
 *   return config
 * })
 *
 * request.interceptors.response.use(
 *   (response) => {
 *     requestLoading?.close()
 *     return response
 *   },
 *   (error) => {
 *     requestLoading?.close()
 *     return Promise.reject(error)
 *   }
 * )
 */
export function createLoading(options: CreateLoadingOptions = {}): LoadingInstance {
  const { onClose, ...rest } = options

  // 使用 useLoading 创建实例，默认全屏模式
  const instance = useLoading({
    ...rest,
    body: true,
  })

  // 包装 close 方法，触发回调
  const originalClose = instance.close
  instance.close = () => {
    originalClose()
    onClose?.()
  }

  return instance
}

/**
 * 创建全屏 loading 的快捷方法
 */
export function createFullscreenLoading(tip?: string, options: Omit<CreateLoadingOptions, 'tip' | 'body'> = {}): LoadingInstance {
  return createLoading({
    tip,
    body: true,
    ...options,
  })
}

/**
 * 创建容器内 loading 的快捷方法
 */
export function createContainerLoading(
  target: HTMLElement | string,
  tip?: string,
  options: Omit<CreateLoadingOptions, 'target' | 'tip' | 'body'> = {},
): LoadingInstance {
  return createLoading({
    target,
    tip,
    body: false,
    ...options,
  })
}
