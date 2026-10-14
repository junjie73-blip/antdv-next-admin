import type { LoadingInstance, UseLoadingOptions } from './types';

import { tryOnUnmounted } from '@vueuse/core';

import { createOverlay } from './overlay';

/**
 * useLoading - 组合式函数
 * 用于在 setup 中控制 loading 状态
 *
 * @example
 * // 全屏 loading
 * const loading = useLoading({ tip: '加载中...' })
 * loading.open()
 * // ... 异步操作
 * loading.close()
 *
 * @example
 * // 容器内 loading（target 支持 ref / getter，延迟到真正显示时才解析）
 * const containerRef = useTemplateRef<HTMLElement>('container')
 * const loading = useLoading({
 *   target: () => containerRef.value,
 *   body: false,
 *   tip: '容器加载中...'
 * })
 *
 * 在组件内调用时会自动在卸载前清理 DOM（`tryOnUnmounted`）；
 * 在组件外（路由守卫、请求拦截器）调用则靠 `close()` / `destroy()` 自行管理。
 */
export function useLoading(options: UseLoadingOptions = {}): LoadingInstance {
  const overlay = createOverlay({ ...options, body: options.body ?? true });
  const { tip } = overlay;

  tryOnUnmounted(overlay.destroy);

  return {
    close: () => {
      overlay.setVisible(false);
    },
    destroy: overlay.destroy,
    open: () => {
      overlay.setVisible(true);
    },
    setTip: (value: string) => {
      tip.value = value;
    },
    setLoading: (value: boolean) => {
      overlay.setVisible(value);
    },
  };
}
