import type { AppSetting } from '@antdv/types';

import { resolveThemeMode } from './theme-mode';

/** 色弱模式：antd 官方推荐写法（invert + grayscale） */
const COLOR_WEAK_FILTER = 'invert(80%) grayscale(100%)';
/** 灰色模式 */
const GRAY_MODE_FILTER = 'grayscale(100%)';

export interface ApplyPreferencesToDomOptions {
  /** 目标元素，默认 `document.documentElement` */
  target?: HTMLElement;
  /** 系统是否偏好深色，用于解析 `theme: 'auto'` */
  isSystemDark?: boolean;
  /** 是否写入 CSS 变量，默认 true；关掉只切 class */
  cssVars?: boolean;
  /**
   * `dark` class 的名字。
   * Tailwind 的 `@custom-variant dark (&:where(.dark, .dark *))` 依赖它，
   * 所以这里不是可选项，只是把名字交给应用决定。
   */
  darkClass?: string;
}

/**
 * 把偏好落到 DOM 上：class 开关 + CSS 变量。
 *
 * 为什么包要管 DOM：`html.dark`、`--ant-color-primary`、色弱滤镜这三件事
 * 散在 App.vue 的三个 watch 里，漏一个就出现"设置面板改了、界面不动"。
 * 收敛成一个函数后，应用只需要在偏好变化时调一次。
 *
 * @returns 解析后的主题（`auto` 已被折叠成 dark / light），可直接用于 antd 主题配置
 */
export function applyPreferencesToDom(
  preferences: AppSetting,
  options: ApplyPreferencesToDomOptions = {},
): 'dark' | 'light' {
  if (typeof document === 'undefined') return 'light';

  const target = options.target ?? document.documentElement;
  const resolvedMode = resolveThemeMode(
    preferences.theme,
    options.isSystemDark ?? false,
  );
  const isDark = resolvedMode === 'dark';

  target.classList.toggle(options.darkClass ?? 'dark', isDark);
  target.classList.toggle('color-weak', preferences.colorWeak);
  target.classList.toggle('gray-mode', preferences.grayMode);
  // 原生控件、滚动条、输入框的配色跟随明暗；漏了它会出现"页面黑了、滚动条还是白的"
  target.style.colorScheme = isDark ? 'dark' : 'light';

  // 两种模式叠乘：色弱本身已经 grayscale，再灰一次仍是灰的，
  // 但把它们拼成一条 filter 链比"后写的覆盖前写的"更好解释。
  const filters = [
    preferences.colorWeak ? COLOR_WEAK_FILTER : '',
    preferences.grayMode ? GRAY_MODE_FILTER : '',
  ].filter(Boolean);
  const filterValue = filters.length > 0 ? filters.join(' ') : 'none';
  // 变量给样式层（@antdv/styles）消费，内联 filter 保证没有样式表时开关也立即生效
  setCssVar(target, '--app-filter', filterValue);
  target.style.filter = filterValue;

  if (options.cssVars !== false) {
    writeThemeCssVars(target, preferences);
  }

  return resolvedMode;
}

/**
 * 写主题相关的 CSS 变量。
 *
 * `--ant-color-primary` 是 antdv-next 运行时注入的命名（39 处在用），
 * `--ant-primary-color` 是旧命名（进度条等几处仍在读）。
 * 两个都写，避免"改了主色、进度条还是蓝的"这种半更新。
 */
function writeThemeCssVars(target: HTMLElement, preferences: AppSetting): void {
  const { borderRadius, fontSize, primaryColor, sidebarWidth } = preferences;

  setCssVar(target, '--ant-color-primary', primaryColor);
  setCssVar(target, '--ant-primary-color', primaryColor);

  // borderRadius 存的是倍率（0 / 0.25 / 0.5 / 0.75 / 1），antd 的基准是 8px
  const radiusPx = `${Math.round(borderRadius * 8 * 100) / 100}px`;
  setCssVar(target, '--ant-border-radius', radiusPx);
  setCssVar(target, '--app-border-radius', radiusPx);

  setCssVar(target, '--ant-font-size', `${fontSize}px`);
  setCssVar(target, '--app-font-size', `${fontSize}px`);

  setCssVar(target, '--app-sidebar-width', `${sidebarWidth}px`);
}

function setCssVar(target: HTMLElement, name: string, value: string): void {
  target.style.setProperty(name, value);
}

/** 移除偏好写下的 class 与变量（登出、卸载或测试收尾时用） */
export function clearPreferencesFromDom(
  options: Pick<
    ApplyPreferencesToDomOptions,
    'darkClass' | 'target'
  > = {},
): void {
  if (typeof document === 'undefined') return;
  const target = options.target ?? document.documentElement;
  target.classList.remove('color-weak', 'gray-mode', options.darkClass ?? 'dark');
  target.style.filter = '';
  target.style.colorScheme = '';
  for (const name of [
    '--ant-color-primary',
    '--ant-primary-color',
    '--ant-border-radius',
    '--ant-font-size',
    '--app-border-radius',
    '--app-font-size',
    '--app-sidebar-width',
    '--app-filter',
  ]) {
    target.style.removeProperty(name);
  }
}
