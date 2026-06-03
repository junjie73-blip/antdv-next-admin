import { nextTick } from 'vue'
import { useAppStore } from '@/stores/modules/app'

export function useThemeTransition() {
  const appStore = useAppStore()

  async function toggleThemeWithAnimation(event?: MouseEvent) {
    const x = event?.clientX ?? window.innerWidth / 2
    const y = event?.clientY ?? window.innerHeight / 2

    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    )

    if (!document.startViewTransition) {
      appStore.toggleTheme()
      return
    }

    const currentTheme = appStore.themeMode

    const transition = document.startViewTransition(async () => {
      appStore.toggleTheme()
      await nextTick()
    })

    transition.ready.then(() => {
      const isToDark = currentTheme === 'light'
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`,
      ]

      // 亮→暗: old(亮色)收缩，需隐藏 new 防止遮挡
      // 暗→亮: new(亮色)展开，new 本身在顶层无需额外处理
      let cleanupStyle: HTMLStyleElement | null = null
      if (isToDark) {
        // 隐藏 new，让 old 的收缩动画可见
        cleanupStyle = document.createElement('style')
        cleanupStyle.textContent = '::view-transition-new(root) { opacity: 0 !important; }'
        document.head.appendChild(cleanupStyle)
        // 等 View Transition 完全结束后再恢复，避免闪烁
        transition.finished.then(() => cleanupStyle?.remove())
      }

      document.documentElement.animate(
        { clipPath: isToDark ? [...clipPath].reverse() : clipPath },
        {
          duration: 400,
          easing: 'ease-in-out',
          pseudoElement: isToDark
            ? '::view-transition-old(root)'
            : '::view-transition-new(root)',
        },
      )
    })
  }

  return {
    toggleThemeWithAnimation,
  }
}
