import { nextTick } from 'vue'

import type { ThemeMode } from '~/settings'

import { useAppStore } from '~/stores/modules/app'

/* ============================================================
 * 判断当前渲染效果是否为暗色
 * ============================================================ */
export function isDarkNow(theme: ThemeMode): boolean {
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/* ============================================================
 * 同步应用主题到 html
 * ============================================================
 * 关键：必须在 startViewTransition 的 callback 里同步执行，
 * 不能 await，否则快照捕获时机错乱，动画失效。
 */
function applyThemeToDom(target: 'light' | 'dark'): void {
  const html = document.documentElement
  html.classList.toggle('dark', target === 'dark')
  html.style.colorScheme = target
}

/* ============================================================
 * 主 Hook
 * ============================================================ */

export function useThemeTransition() {
  const appStore = useAppStore()

  /**
   * 切换到指定主题（带圆形扩散/收缩动画）
   *
   * 完全对齐 Element Plus 示例的方向逻辑：
   *  - light → dark：new（暗色）从 [0, R] 扩散
   *  - dark  → light：old（暗色）从 [R, 0] 收缩
   */
  async function switchThemeWithAnimation(target: 'light' | 'dark', event?: MouseEvent): Promise<void> {
    /* ---------- 1. 渲染色没变：只更新 store ---------- */
    if (isDarkNow(appStore.themeMode) === (target === 'dark')) {
      appStore.updateSetting({ theme: target })
      return
    }

    /* ---------- 2. 计算扩散中心与半径 ---------- */
    const x = event?.clientX ?? window.innerWidth / 2
    const y = event?.clientY ?? window.innerHeight / 2
    const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))

    /* ---------- 3. 不支持 View Transition → 直接切 ---------- */
    if (typeof document.startViewTransition !== 'function') {
      applyThemeToDom(target)
      appStore.updateSetting({ theme: target })
      return
    }

    /* ---------- 4. ⭐ 启动过渡：回调同步改 DOM ---------- */
    const transition = document.startViewTransition(() => {
      // ⭐ 只调用 DOM 操作，不动 store
      // store 更新放在动画结束后，避免响应式干扰
      applyThemeToDom(target)
    })

    await transition.ready

    /* ---------- 5. clipPath 动画 ---------- */
    const isSwitchingToDark = target === 'dark'
    console.log(isSwitchingToDark, target)
    const clipPath = [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`]

    document.documentElement.animate(
      {
        // ⭐ 切暗：扩散；切亮：收缩（参考示例）
        clipPath: isSwitchingToDark ? clipPath : [...clipPath].reverse(),
      },
      {
        duration: 300,
        easing: 'ease-in',
        fill: 'both',
        pseudoElement: isSwitchingToDark
          ? '::view-transition-new(root)' // 切暗：新快照扩散
          : '::view-transition-old(root)', // 切亮：旧快照收缩
      },
    )

    await transition.finished

    /* ---------- 6. ⭐ 动画结束后再同步 store ---------- */
    await nextTick()
    appStore.updateSetting({ theme: target })
  }

  /** 便捷：取反当前主题 */
  async function toggleThemeWithAnimation(event?: MouseEvent): Promise<void> {
    const target: 'light' | 'dark' = isDarkNow(appStore.themeMode) ? 'light' : 'dark'
    return switchThemeWithAnimation(target, event)
  }

  return {
    switchThemeWithAnimation,
    toggleThemeWithAnimation,
    isDarkNow,
  }
}
