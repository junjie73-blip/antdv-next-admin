import { useWindowSize } from '@vueuse/core'
import { computed, type ComputedRef, type Ref } from 'vue'

/**
 * 弹窗自适应高度逻辑
 */
export function useModalHeight(
  height: Ref<number | undefined>,
  minHeight: Ref<number | undefined>,
  footerOffset: Ref<number>,
  _visible: Ref<boolean>,
) {
  // useWindowSize 自动跟随窗口变化并清理监听
  const { height: windowHeight } = useWindowSize()

  const getWrapperHeight: ComputedRef<Record<string, string>> = computed(() => {
    if (height.value) {
      return { height: `${height.value}px` }
    }
    const maxHeight = windowHeight.value - 120 - footerOffset.value
    return {
      maxHeight: `${maxHeight}px`,
      minHeight: minHeight.value ? `${minHeight.value}px` : '200px',
    }
  })

  return { getWrapperHeight }
}
