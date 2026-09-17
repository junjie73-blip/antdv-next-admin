import { nextTick } from "vue";
import { useAppStore } from "@/stores/modules/app";

export function useThemeTransition() {
  const appStore = useAppStore();

  async function toggleThemeWithAnimation(event?: MouseEvent) {
    const x = event?.clientX ?? window.innerWidth / 2;
    const y = event?.clientY ?? window.innerHeight / 2;

    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    // ⭐ 提前判断方向（切换前读，避免异步里状态已变）
    const isToDark = appStore.themeMode === "light";

    if (typeof document.startViewTransition !== "function") {
      appStore.toggleTheme();
      return;
    }

    // ============================================================
    // ⭐ 关键修复：在 startViewTransition 之前注入 opacity:0
    //
    // 注入时机对比：
    // - 晚注入（.ready 之后）：新快照先以 opacity:1 显示一帧 → 闪烁
    // - 早注入（本次）：伪元素从诞生起就透明，无窗口期
    // ============================================================
    let styleEl: HTMLStyleElement | null = null;
    if (isToDark) {
      styleEl = document.createElement("style");
      styleEl.setAttribute("data-theme-transition", "");
      styleEl.textContent = "::view-transition-new(root){opacity:0 !important;}";
      document.head.appendChild(styleEl);
    }

    let transition: ViewTransition | null = null;

    try {
      transition = document.startViewTransition(async () => {
        appStore.toggleTheme();
        await nextTick();
      });

      await transition.ready;

      const clipPath = [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`];

      document.documentElement.animate(
        {
          clipPath: isToDark ? [...clipPath].reverse() : clipPath,
        },
        {
          duration: 400,
          easing: "ease-in-out",
          pseudoElement: isToDark ? "::view-transition-old(root)" : "::view-transition-new(root)",
        },
      );

      await transition.finished;
    } finally {
      // 无论成功失败都清理，避免下次切换受影响
      styleEl?.remove();
    }
  }

  return {
    toggleThemeWithAnimation,
  };
}
