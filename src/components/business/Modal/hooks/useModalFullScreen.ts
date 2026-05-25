import type { ComputedRef, Ref } from 'vue'
import { computed } from 'vue'

/**
 * 弹窗全屏逻辑
 * @param fullscreen - 全屏状态
 * @param canFullscreen - 是否可全屏
 */
export function useModalFullScreen(
  fullscreen: Ref<boolean>,
  canFullscreen: boolean,
) {
  /**
   * 切换全屏
   */
  const toggleFullscreen = () => {
    if (!canFullscreen)
      return
    fullscreen.value = !fullscreen.value
  }

  /**
   * 获取包裹层类名
   */
  const getWrapClassName: ComputedRef<string[]> = computed(() => {
    return [
      'basic-modal-wrap',
      {
        'fullscreen-modal': fullscreen.value,
        'can-fullscreen': canFullscreen,
      },
    ] as string[]
  })

  return {
    toggleFullscreen,
    getWrapClassName,
  }
}
