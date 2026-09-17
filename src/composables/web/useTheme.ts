import { computed } from "vue";

import { useAppStore } from "@/stores/modules/app";

export function useTheme() {
  const appStore = useAppStore();
  const isDark = computed(() => appStore.themeMode === "dark");
  async function toggleTheme(event?: MouseEvent) {
    const x = event?.clientX ?? window.innerWidth / 2;
    const y = event?.clientY ?? window.innerHeight / 2;

    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    if (!document.startViewTransition) {
      appStore.toggleTheme();
      return;
    }

    const transition = document.startViewTransition(() => {
      appStore.toggleTheme();
    });

    await transition.ready;

    const isExpanding = isDark.value;
    document.documentElement.animate(
      {
        clipPath: isExpanding
          ? [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`]
          : [`circle(${endRadius}px at ${x}px ${y}px)`, `circle(0px at ${x}px ${y}px)`],
      },
      {
        duration: 400,
        easing: "ease-in-out",
        pseudoElement: isExpanding ? "::view-transition-new(root)" : "::view-transition-old(root)",
      },
    );
  }

  return {
    toggleTheme,
    isDark,
  };
}
