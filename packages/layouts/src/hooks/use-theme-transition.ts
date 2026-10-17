import type { AppSetting, ThemeMode } from '@antdv/preferences';

import { nextTick } from 'vue';

import { applyPreferencesToDom } from '@antdv/preferences';
import { useAppStore } from '@antdv/stores';
import { createSystemDark, resolveThemeMode } from '@antdv/utils';

/** 系统深色偏好：只在浏览器里查一次，`auto` 模式用它解析 */
const systemDark = createSystemDark();

/** 判断当前**渲染效果**是否为暗色（`auto` 要按系统解析，不能直接比字符串） */
export function isDarkNow(theme: ThemeMode): boolean {
  return resolveThemeMode(theme, systemDark.isDark()) === 'dark';
}

/* ============================================================
 * 同步应用主题到 html
 * ============================================================
 * 关键：必须在 startViewTransition 的 callback 里同步执行，
 * 不能 await，否则快照捕获时机错乱，动画失效。
 *
 * DOM 写入复用 `@antdv/preferences` 的实现（class + CSS 变量 + colorScheme），
 * 只是把 theme 临时替换成动画目标值——避免这里和偏好实例各写一套、互相覆盖。
 */
function applyThemeToDom(target: 'dark' | 'light', appSetting: AppSetting) {
  applyPreferencesToDom({ ...appSetting, theme: target });
}

/**
 * 带圆形扩散/收缩动画的主题切换（顶栏那个明暗按钮）。
 *
 * 方向逻辑对齐 Element Plus 示例：
 * - light → dark：new（暗色）从 [0, R] 扩散
 * - dark → light：old（暗色）从 [R, 0] 收缩
 */
export function useThemeTransition() {
  const appStore = useAppStore();

  async function switchThemeWithAnimation(
    target: 'dark' | 'light',
    event?: MouseEvent,
  ): Promise<void> {
    /* ---------- 1. 渲染色没变：只更新 store ---------- */
    if (isDarkNow(appStore.themeMode) === (target === 'dark')) {
      appStore.updateSetting({ theme: target });
      return;
    }

    /* ---------- 2. 计算扩散中心与半径 ---------- */
    const x = event?.clientX ?? window.innerWidth / 2;
    const y = event?.clientY ?? window.innerHeight / 2;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    /* ---------- 3. 不支持 View Transition → 直接切 ---------- */
    if (typeof document.startViewTransition !== 'function') {
      applyThemeToDom(target, appStore.appSetting);
      appStore.updateSetting({ theme: target });
      return;
    }

    /* ---------- 4. 启动过渡：回调同步改 DOM ---------- */
    const transition = document.startViewTransition(() => {
      // 只调用 DOM 操作，不动 store；store 更新放在动画结束后，避免响应式干扰
      applyThemeToDom(target, appStore.appSetting);
    });

    await transition.ready;

    /* ---------- 5. clipPath 动画 ---------- */
    const isSwitchingToDark = target === 'dark';
    const clipPath = [
      `circle(0px at ${x}px ${y}px)`,
      `circle(${endRadius}px at ${x}px ${y}px)`,
    ];

    document.documentElement.animate(
      {
        clipPath: isSwitchingToDark ? clipPath : [...clipPath].reverse(),
      },
      {
        duration: 300,
        easing: 'ease-in',
        fill: 'both',
        // 切暗：新快照扩散；切亮：旧快照收缩
        pseudoElement: isSwitchingToDark
          ? '::view-transition-new(root)'
          : '::view-transition-old(root)',
      },
    );

    await transition.finished;

    /* ---------- 6. 动画结束后再同步 store ---------- */
    await nextTick();
    appStore.updateSetting({ theme: target });
  }

  async function toggleThemeWithAnimation(event?: MouseEvent): Promise<void> {
    const target: 'dark' | 'light' = isDarkNow(appStore.themeMode)
      ? 'light'
      : 'dark';
    return switchThemeWithAnimation(target, event);
  }

  return {
    isDarkNow,
    switchThemeWithAnimation,
    toggleThemeWithAnimation,
  };
}
