import { ref } from 'vue'

/**
 * Loading 状态管理 Hook
 * 为什么需要：统一管理表格加载状态
 */
export function useLoading(initialValue = false) {
  // 加载状态
  const loadingRef = ref(initialValue)

  /**
   * 设置加载状态
   */
  const setLoading = (value: boolean) => {
    loadingRef.value = value
  }

  /**
   * 开始加载
   */
  const startLoading = () => {
    loadingRef.value = true
  }

  /**
   * 结束加载
   */
  const stopLoading = () => {
    loadingRef.value = false
  }

  return {
    loadingRef,
    setLoading,
    startLoading,
    stopLoading,
  }
}

export type UseLoadingReturn = ReturnType<typeof useLoading>
