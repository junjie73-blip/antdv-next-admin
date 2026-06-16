import { onMounted, onUnmounted } from 'vue'

/**
 * 大屏自适应 Hook
 *
 * 基于 CSS scale 变换实现等比缩放，
 * 保持设计稿（1920x1080）比例在不同分辨率下完整显示。
 * 适用于数据可视化大屏场景。
 */
export function useScreenAdapter(designWidth = 1920, designHeight = 1080, targetId = 'screen-content') {
  const resizeObserver: ResizeObserver | null = null

  function adapt() {
    const contentEl = document.getElementById(targetId)
    if (!contentEl)
      return

    const scaleX = window.innerWidth / designWidth
    const scaleY = window.innerHeight / designHeight
    // 取较小值保证内容完整显示，不溢出
    const scale = Math.min(scaleX, scaleY)

    const scaledWidth = designWidth * scale
    const scaledHeight = designHeight * scale

    contentEl.style.transform = `scale(${scale})`
    contentEl.style.transformOrigin = 'left top'
    contentEl.style.width = `${designWidth}px`
    contentEl.style.height = `${designHeight}px`
    // 在视口中水平和垂直居中，避免单侧大片留白
    contentEl.style.marginLeft = `${Math.max(0, (window.innerWidth - scaledWidth) / 2)}px`
    contentEl.style.marginTop = `${Math.max(0, (window.innerHeight - scaledHeight) / 2)}px`
  }

  onMounted(() => {
    adapt()
    window.addEventListener('resize', adapt)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', adapt)
    resizeObserver?.disconnect()
    // 清理缩放样式，避免污染其他页面
    const contentEl = document.getElementById(targetId)
    if (contentEl) {
      contentEl.style.transform = ''
      contentEl.style.transformOrigin = ''
      contentEl.style.width = ''
      contentEl.style.height = ''
      contentEl.style.marginLeft = ''
      contentEl.style.marginTop = ''
    }
  })

  return { adapt }
}
