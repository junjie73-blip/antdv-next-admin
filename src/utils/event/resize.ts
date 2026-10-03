import { useResizeObserver } from '@vueuse/core'
import { isNil } from 'es-toolkit'
import { onScopeDispose } from 'vue'

/* ============================================================
 * 命令式 API（模块级）
 * ============================================================
 * 用 WeakMap 管理回调集合与 ResizeObserver 实例：
 *  - 避免污染 DOM 元素（原 __resizeListeners__ 方案）
 *  - 元素被 GC 时自动清理，不会内存泄漏
 *  - 类型安全，无 any
 */

/** 回调集合：element → Set<callback> */
const listenerMap = new WeakMap<Element, Set<() => void>>()

/** Observer 实例：element → ResizeObserver */
const observerMap = new WeakMap<Element, ResizeObserver>()

/** 浏览器是否支持原生 ResizeObserver */
const hasNativeResizeObserver = typeof window !== 'undefined' && typeof window.ResizeObserver === 'function'

/**
 * 触发某个元素上注册的所有回调
 */
function dispatchResize(element: Element): void {
  const listeners = listenerMap.get(element)
  if (!listeners || listeners.size === 0) return
  for (const fn of listeners) {
    try {
      fn()
    } catch (error) {
      // 单个回调抛错不影响其他回调
      console.error('[resize] listener error:', error)
    }
  }
}

/**
 * 为元素创建 ResizeObserver（若尚未创建）
 */
function ensureObserver(element: Element): void {
  if (observerMap.has(element)) return

  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      dispatchResize(entry.target)
    }
  })

  observer.observe(element)
  observerMap.set(element, observer)
}

/**
 * 添加 resize 监听（命令式，适用于组件外部调用）
 *
 * @param element - 目标 DOM 元素
 * @param fn - 尺寸变化回调
 *
 * @example
 * ```ts
 * const el = document.querySelector('#panel')!
 * const handler = () => console.log('resized')
 * addResizeListener(el, handler)
 * // 清理
 * removeResizeListener(el, handler)
 * ```
 */
export function addResizeListener(element: Element, fn: () => void): void {
  if (!hasNativeResizeObserver) return
  if (!element) return

  let listeners = listenerMap.get(element)
  if (!listeners) {
    listeners = new Set()
    listenerMap.set(element, listeners)
  }

  listeners.add(fn)
  ensureObserver(element)
}

/**
 * 移除 resize 监听
 *
 * @param element - 目标 DOM 元素
 * @param fn - 之前注册的回调
 */
export function removeResizeListener(element: Element, fn: () => void): void {
  if (!element) return

  const listeners = listenerMap.get(element)
  if (!listeners) return

  listeners.delete(fn)

  // 该元素没有监听者了 → 断开 observer
  if (listeners.size === 0) {
    const observer = observerMap.get(element)
    if (observer) {
      observer.disconnect()
      observerMap.delete(element)
    }
    listenerMap.delete(element)
  }
}

/**
 * 触发一次 window resize 事件
 *
 * 相比原 `document.createEvent('HTMLEvents')` 更简洁、更现代。
 * 注意：使用 `bubbles: false`（与原实现语义一致，只通知 window 直接监听者）。
 */
export function triggerWindowResize(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('resize'))
}

/* ============================================================
 * 组合式 API（组件内推荐）
 * ============================================================
 * 基于 VueUse 的 useResizeObserver：
 *  - 自动跟踪响应式 ref / DOM 元素
 *  - 组件卸载时自动断开
 *  - 无需手动 removeResizeListener
 */

/**
 * 组件内使用的 resize 监听组合式函数
 *
 * @param target - 响应式元素引用 / DOM 元素 / getter
 * @param callback - 尺寸变化回调，接收 ResizeObserverEntry 数组
 * @param options - 透传给 useResizeObserver 的配置
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * const el = ref<HTMLElement>()
 * useResizeListener(el, (entries) => {
 *   console.log('new size:', entries[0].contentRect)
 * })
 * </script>
 *
 * <template>
 *   <div ref="el">...</div>
 * </template>
 * ```
 */
export function useResizeListener(
  target: Parameters<typeof useResizeObserver>[0],
  callback: (entries: ResizeObserverEntry[]) => void,
  options: Parameters<typeof useResizeObserver>[2] = {},
): void {
  useResizeObserver(target, callback, options)

  // useResizeObserver 内部已经通过 tryOnScopeDispose 自动清理，
  // 这里再加一层保险：确保组件/effect scope 销毁时不残留监听
  onScopeDispose(() => {
    // noop：useResizeObserver 已处理
    // 保留回调结构，便于将来扩展
  })
}
