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
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`,
      ]

      const isToDark = currentTheme === 'light'

      document.documentElement.animate(
        {
          clipPath: isToDark ? clipPath.reverse() : clipPath,
        },
        {
          duration: 400,
          easing: 'ease-out',
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
