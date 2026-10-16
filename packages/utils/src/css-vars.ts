import type { AppSetting } from '@antdv/types';

import {
  ANT_BORDER_RADIUS,
  ANT_COLOR_PRIMARY,
  ANT_FONT_SIZE,
  ANT_PRIMARY_COLOR,
  APP_BORDER_RADIUS,
  APP_FILTER,
  APP_FONT_SIZE,
  APP_PRIMARY,
  APP_SIDEBAR_WIDTH,
  BORDER_RADIUS_BASE,
  COLOR_WEAK_CLASS,
  CUSTOM_THEME_KEY,
  DARK_CLASS,
  GRAY_MODE_CLASS,
  PREFERENCE_CSS_VARS,
  THEME_DATA_ATTRIBUTE,
  themeKeyByColor,
} from '@antdv/shared/constants';

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

  target.classList.toggle(options.darkClass ?? DARK_CLASS, isDark);
  target.classList.toggle(COLOR_WEAK_CLASS, preferences.colorWeak);
  target.classList.toggle(GRAY_MODE_CLASS, preferences.grayMode);
  // 原生控件、滚动条、输入框的配色跟随明暗；漏了它会出现"页面黑了、滚动条还是白的"
  target.style.colorScheme = isDark ? 'dark' : 'light';

  // 两种模式叠乘：色弱本身已经 grayscale，再灰一次仍是灰的，
  // 但把它们拼成一条 filter 链比"后写的覆盖前写的"更好解释。
  const filters = [
    preferences.colorWeak ? COLOR_WEAK_FILTER : '',
    preferences.grayMode ? GRAY_MODE_FILTER : '',
  ].filter(Boolean);
  const filterValue = filters.length > 0 ? filters.join(' ') : 'none';
  // 变量给样式层（@antdv/design）消费，内联 filter 保证没有样式表时开关也立即生效
  setCssVar(target, APP_FILTER, filterValue);
  target.style.filter = filterValue;

  if (options.cssVars !== false) {
    writeThemeCssVars(target, preferences);
  }

  return resolvedMode;
}

/**
 * 写主题相关的 CSS 变量与主题档位。
 *
 * `--ant-*` 那一组是留给 antdv-next 组件的桥（antd 的 DOM 还在页面里），
 * 设计规范本身一律读 `--app-*`，见 `@antdv/design`。
 * `--ant-color-primary` 是 antdv-next 运行时注入的命名（39 处在用），
 * `--ant-primary-color` 是旧命名（进度条等几处仍在读）。
 * 两个都写，避免"改了主色、进度条还是蓝的"这种半更新。
 *
 * 主题档位写在 `<html data-theme>` 上：预设主题各自带一整套色板（`@antdv/design`
 * 的 token 文件），所以只有取色器选的颜色才需要内联 `--app-primary` —— 预设时
 * 内联反而会把暗色档提亮过的主色压回亮色值。
 */
function writeThemeCssVars(target: HTMLElement, preferences: AppSetting): void {
  const { borderRadius, fontSize, primaryColor, sidebarWidth } = preferences;
  const themeKey = themeKeyByColor(primaryColor);

  target.setAttribute(THEME_DATA_ATTRIBUTE, themeKey);
  if (themeKey === CUSTOM_THEME_KEY) {
    setCssVar(target, APP_PRIMARY, primaryColor);
  } else {
    target.style.removeProperty(APP_PRIMARY);
  }

  setCssVar(target, ANT_COLOR_PRIMARY, primaryColor);
  setCssVar(target, ANT_PRIMARY_COLOR, primaryColor);

  // borderRadius 存的是倍率（0 / 0.25 / 0.5 / 0.75 / 1），antd 的基准是 8px
  const radiusPx = `${Math.round(borderRadius * BORDER_RADIUS_BASE * 100) / 100}px`;
  setCssVar(target, ANT_BORDER_RADIUS, radiusPx);
  setCssVar(target, APP_BORDER_RADIUS, radiusPx);

  setCssVar(target, ANT_FONT_SIZE, `${fontSize}px`);
  setCssVar(target, APP_FONT_SIZE, `${fontSize}px`);

  setCssVar(target, APP_SIDEBAR_WIDTH, `${sidebarWidth}px`);
}

function setCssVar(target: HTMLElement, name: string, value: string): void {
  target.style.setProperty(name, value);
}

/** 移除偏好写下的 class 与变量（登出、卸载或测试收尾时用） */
export function clearPreferencesFromDom(
  options: Pick<ApplyPreferencesToDomOptions, 'darkClass' | 'target'> = {},
): void {
  if (typeof document === 'undefined') return;
  const target = options.target ?? document.documentElement;
  target.classList.remove(
    COLOR_WEAK_CLASS,
    GRAY_MODE_CLASS,
    options.darkClass ?? DARK_CLASS,
  );
  target.style.filter = '';
  target.style.colorScheme = '';
  target.removeAttribute(THEME_DATA_ATTRIBUTE);
  for (const name of PREFERENCE_CSS_VARS) {
    target.style.removeProperty(name);
  }
}
