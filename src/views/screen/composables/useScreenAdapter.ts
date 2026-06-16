import { onMounted, onUnmounted } from 'vue'

/**
 * 大屏自适应 Hook
 *
 * 基于 CSS scale 变换实现等比缩放，
 * 保持设计稿（1920x1080）比例在不同分辨率下完整显示。
 * 适用于数据可视化大屏场景。
 */
export function useScreenAdapter(designWidth = 1920, designHeight = 1080) {
  const resizeObserver: ResizeObserver | null = null

  function adapt() {
    const appEl = document.getElementById('screen-container')
    if (!appEl)
      return

    const scaleX = window.innerWidth / designWidth
    const scaleY = window.innerHeight / designHeight
    // 取较小值保证内容完整显示，不溢出
    const scale = Math.min(scaleX, scaleY)

    appEl.style.transform = `scale(${scale})`
    appEl.style.transformOrigin = 'left top'
    appEl.style.width = `${designWidth}px`
    appEl.style.height = `${designHeight}px`
  }

  onMounted(() => {
    adapt()
    window.addEventListener('resize', adapt)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', adapt)
    resizeObserver?.disconnect()
  })

  return { adapt }
}
