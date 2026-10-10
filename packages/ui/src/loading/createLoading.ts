import type { CreateLoadingOptions, LoadingInstance } from './types';

import { useLoading } from './useLoading';

/**
 * createLoading - 函数式创建 loading
 * 用于在任意位置（包括组件外）创建 loading 实例
 *
 * @example
 * // 在路由守卫中使用
 * import { createLoading } from '@antdv/ui/loading'
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
export function createLoading(
  options: CreateLoadingOptions = {},
): LoadingInstance {
  const { onClose, ...rest } = options;

  // 函数式调用点通常在组件外，不自动清理，由 close()/destroy() 负责。
  // body 默认 true（全屏），但必须允许 createContainerLoading 显式传 false ——
  // 早期版本写的是 `{ ...rest, body: true }`，把容器模式覆盖掉了。
  const instance = useLoading({ body: true, ...rest });

  return {
    ...instance,
    close: () => {
      instance.close();
      onClose?.();
    },
  };
}

/**
 * 创建全屏 loading 的快捷方法
 */
export function createFullscreenLoading(
  tip?: string,
  options: Omit<CreateLoadingOptions, 'body' | 'tip'> = {},
): LoadingInstance {
  return createLoading({ ...options, tip });
}

/**
 * 创建容器内 loading 的快捷方法
 */
export function createContainerLoading(
  target: CreateLoadingOptions['target'],
  tip?: string,
  options: Omit<CreateLoadingOptions, 'body' | 'target' | 'tip'> = {},
): LoadingInstance {
  return createLoading({ ...options, body: false, target, tip });
}
