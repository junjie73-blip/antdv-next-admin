import type { AppSetting } from '@antdv/types';

import { buildStorageKey } from '@antdv/shared/cache';
import { themeKeyByColor } from '@antdv/shared/constants';
import { resolveThemeMode } from '@antdv/utils';

import { BOOT_THEME_CACHE_KEY, BOOT_THEME_SNAPSHOT_VERSION } from './constants';

/**
 * 快照里带的三条颜色。
 *
 * 名字来自 `@antdv/design/src/token/{default,dark}.css`，这里**只读不写**：
 * 预设主题的主色在暗色档会被提亮一档（JS 侧的 `THEME_PRESETS` 只有亮色值），
 * 所以取"当时 DOM 上算出来的值"比重新推导一套更可靠 —— 写快照的那一刻样式必然
 * 已经生效，读到的就是用户此刻真正看到的颜色。
 *
 * 读回来的是 shadcn 规范名里那串 **HSL 通道值**（`215 100% 54%`），不是完整颜色。
 * 读侧（loading 模板）负责套 `hsl()`，快照本身只负责搬运，不在这里做格式转换 ——
 * 转换过一遍就得再转回来，`color-mix()` 与 alpha 都会在半路丢掉。
 */
const BOOT_THEME_VARS = {
  background: '--background',
  foreground: '--foreground',
  primary: '--primary',
} as const;

export type BootThemeVarName = keyof typeof BOOT_THEME_VARS;

export interface BootThemeSnapshot {
  /** 色弱模式，首屏脚本据此复原滤镜，避免"遮罩彩色、挂载后变负片" */
  colorWeak: boolean;
  /** 灰色模式 */
  grayMode: boolean;
  /**
   * `vars` 是在哪一档明暗下取的。
   *
   * 存下来而不是让读侧猜：`theme: 'auto'` 的用户可能在关掉页面之后把系统主题改了，
   * 这时快照里的颜色属于另一个模式，直接用会深色底上贴一块亮色遮罩。
   * 读侧只在模式一致时才用快照值，否则退回模板的 `hsl(var(--x, 兜底))` 链
   * （那条链跟着 design 色板走，样式表落地后自然就是对的）。
   */
  mode: 'dark' | 'light';
  /** 主题档位，即 `<html data-theme>` 的值，与 `themeKeyByColor` 同一份推导 */
  themeKey: string;
  /**
   * 存**原始**偏好而不是解析结果：`auto` 由读侧按当下的系统偏好再算一次。
   * 存解析结果会把用户某天在系统里换深色这件事冻在旧值上。
   */
  theme: AppSetting['theme'];
  /** 写快照那一刻的色板值（HSL 通道串），取不到（SSR / 无样式环境）就是空串 */
  vars: Record<BootThemeVarName, string>;
  /**
   * 快照格式版本。
   *
   * token 从"完整颜色"换成"HSL 通道串"是一次不兼容变更：老快照里的 `#1677ff`
   * 套进模板的 `hsl(var(--loading-background))` 会解析失败，遮罩直接变透明。
   * 键名保持不动、只加版本号，是因为 `commit()` 每次都会重写快照 —— 换新键会
   * 在盘上留一条永远没人清的孤儿数据，而版本号让读侧一次判断、下次写入自然覆盖。
   */
  version: number;
}

function readThemeVar(name: string): string {
  try {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
  } catch {
    // happy-dom 与 SSR 下可能没有 getComputedStyle；缺值只意味着首屏用模板兜底色
    return '';
  }
}

export function buildBootThemeSnapshot(
  preferences: AppSetting,
  isSystemDark = false,
): BootThemeSnapshot {
  return {
    colorWeak: preferences.colorWeak,
    grayMode: preferences.grayMode,
    mode: resolveThemeMode(preferences.theme, isSystemDark),
    theme: preferences.theme,
    themeKey: themeKeyByColor(preferences.primaryColor),
    vars: {
      background: readThemeVar(BOOT_THEME_VARS.background),
      foreground: readThemeVar(BOOT_THEME_VARS.foreground),
      primary: readThemeVar(BOOT_THEME_VARS.primary),
    },
    version: BOOT_THEME_SNAPSHOT_VERSION,
  };
}

/**
 * 写下"下一次首屏该画成什么样"。
 *
 * 调用点在 `commit()` 里、`applyDom()` **之后**：先让新的 `data-theme` / `dark`
 * class 生效，`getComputedStyle` 算出的才是新主题的颜色；反过来写就会把首屏钉在
 * 上一套主题上，而且每次改设置都差一档，永远追不上。
 *
 * 消费方是 `vite-plugin-app-loading` 注入 `<head>` 的内联脚本 —— 它跑在应用代码
 * 之前，既没有解密能力（加密密钥由应用注入），也不该拿到全部设置，所以这份快照
 * 只含"画对首屏颜色"所需的字段，明文落盘。
 */
export function writeBootThemeCache(
  preferences: AppSetting,
  isSystemDark = false,
): void {
  if (typeof document === 'undefined' || typeof localStorage === 'undefined')
    return;

  try {
    localStorage.setItem(
      buildStorageKey(BOOT_THEME_CACHE_KEY),
      JSON.stringify(buildBootThemeSnapshot(preferences, isSystemDark)),
    );
  } catch {
    /* 隐私模式写不进 localStorage：首屏退回模板兜底色，不该因此拖垮设置面板 */
  }
}

export function readBootThemeCache(): BootThemeSnapshot | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(buildStorageKey(BOOT_THEME_CACHE_KEY));
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as BootThemeSnapshot;
    // 老格式的快照（完整颜色）与读侧的 `hsl(var(--x))` 组合不兼容，当成没有：
    // 首屏退回模板兜底色，下一次 commit 就会覆盖成新版式。
    if (snapshot.version !== BOOT_THEME_SNAPSHOT_VERSION) return null;
    return snapshot;
  } catch {
    return null;
  }
}

export function clearBootThemeCache(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(buildStorageKey(BOOT_THEME_CACHE_KEY));
}
