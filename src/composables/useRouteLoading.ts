/**
 * useRouteLoading - 路由切换 Loading 状态管理
 *
 * 功能：
 * 1. 路由切换时自动显示/隐藏 Loading
 * 2. 最小显示时间控制（防止闪烁）
 * 3. 慢加载检测和警告
 * 4. 支持手动触发（withLoading）
 *
 * 注：路由性能监控已由 src/monitor 统一管理，无需在此重复初始化
 */
import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export interface RouteLoadingOptions {
  /** 最小显示时间 (ms)，防止闪烁 */
  minDuration?: number
  /** 是否启用自动模式（监听路由变化） */
  auto?: boolean
}

export function useRouteLoading(options: RouteLoadingOptions = {}) {
  const {
    minDuration = 300,
    auto = true,
  } = options

  const router = useRouter()
  const route = useRoute()

  // 状态
  const isLoading = ref(false)
  const isComplete = ref(false)
  const isError = ref(false)
  const startTime = ref(0)

  // 定时器
  let completeTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * 开始加载
   */
  function start() {
    if (isLoading.value && !isComplete.value)
      return

    isLoading.value = isComplete.value = isError.value = false
    startTime.value = Date.now()

    requestAnimationFrame(() => {
      isLoading.value = true
      isComplete.value = false
    })
  }

  /**
   * 完成加载（成功）
   */
  function complete() {
    completeInternal(false)
  }

  /**
   * 完成加载（失败）
   */
  function error() {
    completeInternal(true)
  }

  /**
   * 内部完成逻辑
   */
  function completeInternal(error: boolean) {
    if (!isLoading.value) {
      return
    }

    const elapsed = Date.now() - startTime.value
    const remaining = Math.max(0, minDuration - elapsed)

    if (completeTimer) {
      clearTimeout(completeTimer)
    }

    completeTimer = setTimeout(() => {
      isComplete.value = !error
      isError.value = error

      setTimeout(() => {
        isLoading.value = false
        isComplete.value = false
        isError.value = false
      }, error ? 500 : 200)
    }, remaining)
  }

  /**
   * 取消加载
   */
  function cancel() {
    if (!isLoading.value)
      return

    reset()
  }

  /**
   * 手动触发完整的加载-完成流程
   */
  async function withLoading<T>(fn: () => Promise<T>): Promise<T> {
    start()
    try {
      const result = await fn()
      return result
    }
    catch (e) {
      error()
      throw e
    }
    finally {
      complete()
    }
  }

  /**
   * 重置状态
   */
  function reset() {
    if (completeTimer) {
      clearTimeout(completeTimer)
      completeTimer = null
    }
    isLoading.value = false
    isComplete.value = false
    isError.value = false
    startTime.value = 0
  }

  // 计算属性
  const progress = computed(() => {
    if (!isLoading.value)
      return 0
    if (isComplete.value || isError.value)
      return 100

    const elapsed = Date.now() - startTime.value
    return Math.min(90, 10 + (elapsed / (minDuration * 3)) * 80)
  })

  // 当前耗时
  const elapsed = computed(() => {
    if (!startTime.value)
      return 0
    return Date.now() - startTime.value
  })

  // 是否慢加载
  const isSlow = computed(() => {
    return elapsed.value > 3000 && isLoading.value
  })

  // 自动模式：监听路由变化
  if (auto) {
    watch(
      () => route.path,
      async () => {
        start()
        await new Promise(resolve => setTimeout(resolve, minDuration))
        complete()
      },
    )

    router.beforeEach((_to, _from, next) => {
      start()
      next()
    })

    router.afterEach((to) => {
      setTimeout(() => {
        complete()
      }, minDuration / 2)
    })
  }

  // 清理定时器
  tryOnScopeDispose(() => {
    reset()
  })

  return {
    // 状态
    isLoading: computed(() => isLoading.value),
    isComplete: computed(() => isComplete.value),
    isError: computed(() => isError.value),
    progress,
    elapsed,
    isSlow,

    // 方法
    start,
    complete,
    error,
    cancel,
    withLoading,
    reset,
  }
}
