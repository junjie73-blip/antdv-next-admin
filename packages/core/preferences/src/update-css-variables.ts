import type { AppSetting } from '@antdv/types';

import type { ApplyPreferencesToDomOptions } from './types';

import { convertToHslCssVar } from '@antdv/shared/color';
import {
  BASE_FONT_SIZE,
  BORDER_RADIUS_BASE,
  COLOR_WEAK_CLASS,
  CSS_VAR_FILTER,
  CSS_VAR_FONT_SIZE,
  CSS_VAR_PRIMARY,
  CSS_VAR_RADIUS,
  CUSTOM_THEME_KEY,
  GRAY_MODE_CLASS,
  PREFERENCE_CSS_VARS,
  THEME_DATA_ATTRIBUTE,
  themeKeyByColor,
} from '@antdv/shared/constants';
import { radiusToRem } from '@antdv/shared/utils';
import { resolveThemeMode } from '@antdv/utils';

import {
  COLOR_WEAK_FILTER,
  DEFAULT_DARK_CLASS,
  GRAY_MODE_FILTER,
} from './constants';

/**
 * 把偏好落到 DOM 上：class 开关 + CSS 变量。
 *
 * 为什么包要管 DOM：`html.dark`、`--primary`、色弱滤镜这三件事散在 App.vue 的
 * 三个 watch 里时，漏一个就出现"设置面板改了、界面不动"。
 * 收敛成一个函数后，应用只需要在偏好变化时调一次。
 *
 * @returns 解析后的主题（`auto` 已被折叠成 dark / light），可直接用于判断明暗
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

  target.classList.toggle(options.darkClass ?? DEFAULT_DARK_CLASS, isDark);
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
  setCssVar(target, CSS_VAR_FILTER, filterValue);
  target.style.filter = filterValue;

  if (options.cssVars !== false) {
    writeThemeCssVars(target, preferences);
  }

  return resolvedMode;
}

/**
 * 写主题相关的 CSS 变量与主题档位。
 *
 * 主题档位写在 `<html data-theme>` 上：预设主题各自带一整套色板（`@antdv/design`
 * 的 token 文件），所以只有取色器选的颜色才需要内联 `--primary` —— 预设时
 * 内联反而会把暗色档提亮过的主色压回亮色值。
 *
 * 圆角与字号写的是 `@antdv/design` 里那条**唯一**的变量：半径走 `--radius-*`
 * 工具类刻度，字号走根字号。两边都只有一份写侧，不会变成"偏好写了新值、
 * 样式还在读旧名字"的静默失效（被删掉的 `--ant-*` 四条正是这个形态的死代码）。
 */
function writeThemeCssVars(target: HTMLElement, preferences: AppSetting): void {
  const { borderRadius, fontSize, primaryColor } = preferences;
  const themeKey = themeKeyByColor(primaryColor);

  target.setAttribute(THEME_DATA_ATTRIBUTE, themeKey);
  if (themeKey === CUSTOM_THEME_KEY) {
    // 变量里只存 HSL 三段：读侧统一是 `hsl(var(--primary))`，把 `#1677ff` 这种
    // 完整颜色写进去会让外层再套一层 hsl()，解析失败后主色直接变成不合法值。
    setCssVar(target, CSS_VAR_PRIMARY, convertToHslCssVar(primaryColor));
  } else {
    target.style.removeProperty(CSS_VAR_PRIMARY);
  }

  // borderRadius 存的是倍率（0 / 0.25 / 0.5 / 0.75 / 1），基准 16px 即 token 的 `--radius` 档。
  // 单位一律 rem（`radiusToRem` 是全站唯一的 px→rem 换算出口）：默认根字号下 1rem = 16px，
  // 计算值与改造前一致，但圆角从此跟着 `--font-size` 一起缩放。
  setCssVar(
    target,
    CSS_VAR_RADIUS,
    radiusToRem(borderRadius * BORDER_RADIUS_BASE),
  );

  /*
   * 字号偏好存的是"正文要多大"（px，默认 14），而正文用的是 `text-sm` = 0.875rem ——
   * rem 的锚点是根字号，所以这里把 px 折算成相对根字号的百分比：
   * 14px 正文 → 100%（根字号仍是浏览器默认的 16px），16px 正文 → 114.29%。
   * 直接写 `${fontSize}px` 不行：那条声明落在 html 上会让所有 rem 尺寸
   * （间距、图标、控件高）一起按 14/16 缩，界面整体小一圈，只有文字变了。
   */
  setCssVar(
    target,
    CSS_VAR_FONT_SIZE,
    `${Math.round((fontSize / BASE_FONT_SIZE) * 10_000) / 100}%`,
  );
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
    options.darkClass ?? DEFAULT_DARK_CLASS,
  );
  target.style.filter = '';
  target.style.colorScheme = '';
  target.removeAttribute(THEME_DATA_ATTRIBUTE);
  for (const name of PREFERENCE_CSS_VARS) {
    target.style.removeProperty(name);
  }
}

function setCssVar(target: HTMLElement, name: string, value: string): void {
  target.style.setProperty(name, value);
}
