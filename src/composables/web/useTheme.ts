import { useAppStore } from '@/stores/modules/app'

export function useTheme() {
  const appStore = useAppStore()

  const toggleTheme = async (event: MouseEvent) => {
    const isDark = appStore.appSetting.theme === 'dark'
    const x = event.clientX
    const y = event.clientY

    const endRadius = Math.hypot(
      Math.max(x, innerWidth - x),
      Math.max(y, innerHeight - y),
    )

    if (!document.startViewTransition) {
      appStore.setTheme(isDark ? 'light' : 'dark')
      return
    }

    const transition = document.startViewTransition(() => {
      appStore.setTheme(isDark ? 'light' : 'dark')
    })

    await transition.ready

    const isExpanding = !isDark
    const root = document.documentElement
    if (root) {
      root.animate(
        {
          clipPath: isExpanding
            ? [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`]
            : [`circle(${endRadius}px at ${x}px ${y}px)`, `circle(0px at ${x}px ${y}px)`],
        },
        {
          duration: 800,
          easing: 'ease-in-out',
          pseudoElement: isExpanding
            ? '::view-transition-new(root)'
            : '::view-transition-old(root)',
        },
      )
    }
  }

  return {
    toggleTheme,
    isDark: computed(() => appStore.appSetting.theme === 'dark'),
  }
}
