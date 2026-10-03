import { useEventListener } from '@vueuse/core'
import { computed, ref, watch, type Ref } from 'vue'

/**
 * 弹窗拖拽逻辑
 * @param draggable 是否可拖拽
 * @param visible 弹窗显示状态
 * @param fullscreen 全屏状态
 */
export function useDragMove(draggable: Ref<boolean>, visible: Ref<boolean>, fullscreen: Ref<boolean>) {
  const offsetX = ref(0)
  const offsetY = ref(0)
  const isDragging = ref(false)
  const startMouseX = ref(0)
  const startMouseY = ref(0)
  const startOffsetX = ref(0)
  const startOffsetY = ref(0)

  const dragStyle = computed(() => {
    if (offsetX.value === 0 && offsetY.value === 0) return {}
    return { transform: `translate(${offsetX.value}px, ${offsetY.value}px)` }
  })

  const handleDragStart = (e: MouseEvent) => {
    if (!draggable.value || fullscreen.value) return

    const target = e.target as HTMLElement
    if (!target.closest('.modal-header')) return
    if (target.closest('button')) return

    isDragging.value = true
    startMouseX.value = e.clientX
    startMouseY.value = e.clientY
    startOffsetX.value = offsetX.value
    startOffsetY.value = offsetY.value
  }

  // useEventListener：组件卸载时自动解绑，无需手动 removeEventListener
  useEventListener(document, 'mousemove', (e: MouseEvent) => {
    if (!isDragging.value) return
    offsetX.value = startOffsetX.value + (e.clientX - startMouseX.value)
    offsetY.value = startOffsetY.value + (e.clientY - startMouseY.value)
  })

  useEventListener(document, 'mouseup', () => {
    isDragging.value = false
  })

  // 弹窗关闭时重置位置
  watch(visible, (val) => {
    if (!val) {
      offsetX.value = 0
      offsetY.value = 0
    }
  })

  return { dragStyle, handleDragStart }
}
