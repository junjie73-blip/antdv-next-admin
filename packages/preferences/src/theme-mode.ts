import type { ThemeMode } from '@antdv/types';

/** 解析后的主题：只有明/暗两态，`auto` 是"跟随系统"的策略而非结果 */
export type ResolvedThemeMode = 'dark' | 'light';

/**
 * 把 `auto` 折叠成具体模式。
 *
 * 以前应用侧写的是 `themeMode === 'dark'`：默认值恰恰是 `auto`，
 * 于是"跟随系统"永远解析成浅色——OS 切成深色也只有一半界面变暗
 * （html 上的 `dark` class、antd 的 darkAlgorithm 各判各的）。
 * 统一走这里，两边共用同一个判定。
 */
export function resolveThemeMode(
  mode: ThemeMode = 'light',
  isSystemDark = false,
): ResolvedThemeMode {
  if (mode === 'auto') return isSystemDark ? 'dark' : 'light';
  return mode === 'dark' ? 'dark' : 'light';
}

export interface SystemDarkOptions {
  /** 注入 matchMedia，方便单测与 SSR */
  matchMedia?: (query: string) => MediaQueryList;
}

export interface SystemDark {
  /** 当前系统是否偏好深色；不支持 matchMedia 时恒为 false */
  isDark: () => boolean;
  /**
   * 订阅系统主题变化，返回取消订阅函数。
   *
   * `addEventListener` 与已废弃的 `addListener` 都要兼容：
   * Safari 14 之前只有后者，直接调用会在"跟随系统"模式下静默失效。
   */
  subscribe: (listener: (isDark: boolean) => void) => () => void;
  /** 是否真的拿到了系统偏好（false 表示降级为浅色） */
  supported: () => boolean;
}

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function createSystemDark(options: SystemDarkOptions = {}): SystemDark {
  const listeners = new Set<(isDark: boolean) => void>();

  const matchFn =
    options.matchMedia ??
    (typeof window === 'undefined' ? undefined : window.matchMedia?.bind(window));

  // SSR 或不支持 matchMedia 的老浏览器：不抛错，降级成"永远浅色"
  const media = matchFn ? matchFn(DARK_QUERY) : null;

  if (!media) {
    return {
      isDark: () => false,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      supported: () => false,
    };
  }

  // change 事件触发时 media.matches 已经是新值，不必再从 event 上取。
  // 监听器只在有订阅者时才挂上（懒挂载），没人订阅就不占用系统回调。
  const handler = () => {
    const matches = media.matches;
    listeners.forEach((listener) => listener(matches));
  };

  return {
    isDark: () => media.matches,
    subscribe: (listener) => {
      listeners.add(listener);
      if (listeners.size === 1) {
        if (typeof media.addEventListener === 'function') {
          media.addEventListener('change', handler);
        } else {
          media.addListener?.(handler);
        }
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          if (typeof media.removeEventListener === 'function') {
            media.removeEventListener('change', handler);
          } else {
            media.removeListener?.(handler);
          }
        }
      };
    },
    supported: () => true,
  };
}
