import type { ComputedRef, Ref } from 'vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'

/**
 * 弹窗自适应高度逻辑
 * @param height - 固定高度
 * @param minHeight - 最小高度
 * @param footerOffset - 底部偏移量
 * @param visible - 弹窗显示状态
 */
export function useModalHeight(
  height: Ref<number | undefined>,
  minHeight: Ref<number | undefined>,
  footerOffset: Ref<number>,
  visible: Ref<boolean>,
) {
  // 窗口高度
  const windowHeight = ref(window.innerHeight)

  /**
   * 获取包装器高度样式
   */
  const getWrapperHeight: ComputedRef<Record<string, string>> = computed(() => {
    if (height.value) {
      return {
        height: `${height.value}px`,
      }
    }

    // 视口高度 - 顶部间距 - 底部间距 - footerOffset
    const maxHeight = windowHeight.value - 120 - footerOffset.value

    return {
      maxHeight: `${maxHeight}px`,
      minHeight: minHeight.value ? `${minHeight.value}px` : '200px',
    }
  })

  /**
   * 窗口大小变化处理
   */
  const handleResize = () => {
    windowHeight.value = window.innerHeight
  }

  // 监听窗口大小变化
  onMounted(() => {
    window.addEventListener('resize', handleResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
  })

  return {
    getWrapperHeight,
  }
}
