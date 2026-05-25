import type { Ref } from 'vue'
import { computed, ref, watch } from 'vue'

/**
 * 弹窗拖拽逻辑
 * @param draggable - 是否可拖拽
 * @param visible - 弹窗显示状态
 * @param fullscreen - 全屏状态
 */
export function useDragMove(
  draggable: Ref<boolean>,
  visible: Ref<boolean>,
  fullscreen: Ref<boolean>,
) {
  // 拖拽位置
  const x = ref(0)
  const y = ref(0)
  const isDragging = ref(false)
  const startX = ref(0)
  const startY = ref(0)
  const initialX = ref(0)
  const initialY = ref(0)

  // 拖拽样式
  const dragStyle = computed(() => {
    if (x.value === 0 && y.value === 0) {
      return {}
    }
    return {
      transform: `translate(${x.value}px, ${y.value}px)`,
    }
  })

  /**
   * 开始拖拽
   */
  const handleDragStart = (e: MouseEvent) => {
    // 不可拖拽或全屏时不处理
    if (!draggable.value || fullscreen.value)
      return

    // 只有点击 header 才能拖拽
    const target = e.target as HTMLElement
    const header = target.closest('.modal-header')
    if (!header)
      return

    // 如果点击的是按钮，不触发拖拽
    if (target.closest('button'))
      return

    isDragging.value = true
    startX.value = e.clientX
    startY.value = e.clientY
    initialX.value = x.value
    initialY.value = y.value

    // 添加全局事件监听
    document.addEventListener('mousemove', handleDragMove)
    document.addEventListener('mouseup', handleDragEnd)
  }

  /**
   * 拖拽中
   */
  const handleDragMove = (e: MouseEvent) => {
    if (!isDragging.value)
      return

    const deltaX = e.clientX - startX.value
    const deltaY = e.clientY - startY.value

    x.value = initialX.value + deltaX
    y.value = initialY.value + deltaY
  }

  /**
   * 结束拖拽
   */
  const handleDragEnd = () => {
    isDragging.value = false
    document.removeEventListener('mousemove', handleDragMove)
    document.removeEventListener('mouseup', handleDragEnd)
  }

  // 弹窗关闭时重置位置
  watch(visible, (val) => {
    if (!val) {
      x.value = 0
      y.value = 0
    }
  })

  return {
    dragStyle,
    handleDragStart,
  }
}
