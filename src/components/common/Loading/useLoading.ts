import type { LoadingInstance, UseLoadingOptions } from './types'
import { tryOnUnmounted } from '@vueuse/core'
import { createApp, ref, unref } from 'vue'
import Loading from './Loading.vue'

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
 * // 容器内 loading
 * const containerRef = ref<HTMLElement>()
 * const loading = useLoading({
 *   target: containerRef,
 *   body: false,
 *   tip: '容器加载中...'
 * })
 */
export function useLoading(options: UseLoadingOptions = {}): LoadingInstance {
  const {
    target = document.body,
    body = true,
    wrapClass,
    ...props
  } = options

  // 响应式状态
  const loadingRef = ref(props.loading ?? false)
  const tipRef = ref(props.tip ?? '')

  // DOM 元素和组件实例引用
  let loadingEl: HTMLDivElement | null = null
  let app: ReturnType<typeof createApp> | null = null
  let vm: InstanceType<typeof Loading> | null = null

  /**
   * 获取目标元素 — 确保返回有效的 DOM 元素
   */
  const getTargetElement = (): Element | null => {
    if (typeof target === 'string') {
      return document.querySelector(target)
    }
    const el = unref(target)
    // 兼容 ref<Element> 和直接传入 DOM 元素的情况
    if (el instanceof Element)
      return el
    return null
  }

  /**
   * 创建 loading DOM 元素和组件
   */
  const createLoadingEl = () => {
    if (loadingEl)
      return

    const targetEl = getTargetElement()

    if (!targetEl) {
      console.warn('[useLoading] target element not found')
      return
    }

    // 确保目标容器有定位（非 body 挂载时）
    if (!body && targetEl instanceof Element) {
      const targetPosition = getComputedStyle(targetEl).position
      if (targetPosition === 'static') {
        targetEl.style.position = 'relative'
      }
    }

    // 创建容器元素
    loadingEl = document.createElement('div')
    if (wrapClass) {
      loadingEl.className = wrapClass
    }

    // 创建 Vue 应用实例
    app = createApp(Loading, {
      ...props,
      loading: loadingRef.value,
      tip: tipRef.value,
      absolute: !body,
    })

    // 挂载组件
    vm = app.mount(loadingEl) as InstanceType<typeof Loading>

    // 添加到 DOM
    if (body) {
      document.body.appendChild(loadingEl)
    }
    else {
      targetEl.appendChild(loadingEl)
    }
  }

  /**
   * 移除 loading DOM 元素和组件
   */
  const removeLoadingEl = () => {
    if (app && loadingEl) {
      app.unmount()
      loadingEl.remove()
      app = null
      vm = null
      loadingEl = null
    }
  }

  /**
   * 延迟移除（等待动画结束）
   */
  const delayRemove = () => {
    setTimeout(() => {
      if (!loadingRef.value) {
        removeLoadingEl()
      }
    }, 300)
  }

  /**
   * 打开 loading
   */
  const open = () => {
    if (!loadingEl) {
      createLoadingEl()
    }
    loadingRef.value = true
    // 更新组件 props
    if (vm) {
      vm.$emit('update:loading', true)
    }
  }

  /**
   * 关闭 loading
   */
  const close = () => {
    loadingRef.value = false
    delayRemove()
  }

  /**
   * 动态修改提示文本
   */
  const setTip = (tip: string) => {
    tipRef.value = tip
    if (vm) {
      vm.$emit('update:tip', tip)
    }
  }

  /**
   * 动态修改加载状态
   */
  const setLoading = (loading: boolean) => {
    loadingRef.value = loading
    if (!loading) {
      delayRemove()
    }
  }

  // 自动打开（如果初始 loading 为 true）
  if (props.loading) {
    createLoadingEl()
  }

  // 组件卸载时自动清理
  tryOnUnmounted(() => {
    removeLoadingEl()
  })

  return {
    open,
    close,
    setTip,
    setLoading,
  }
}
