/**
 * 偏好写到 DOM 上的 CSS 变量名。
 *
 * 这些名字是"写侧"（`@antdv/preferences` 的 applyPreferencesToDom）与
 * "读侧"（`@antdv/design` 的 token、各组件里的 `var()`）之间的契约。
 * 名字散在两处维护，改名时不会报错，只会变成"写了新变量、样式还在读旧变量"
 * 的静默失效，所以统一由这里给出。
 *
 * 名单纪律：**只收有读取点的名字**。曾经的 `--ant-*` 四条是留给页面上 antd 组件的桥，
 * antd 的 DOM 请出去之后它们只剩"每次换主题多写四条没人读的声明"；
 * `--app-sidebar-width` 同理 —— 侧栏宽度由偏好直接作为 prop 交给外壳，不绕 CSS。
 */

/** 圆角刻度基准（`@antdv/design` 的 `--radius-*` 比例按它派生） */
export const APP_BORDER_RADIUS = '--app-border-radius';
/** 色弱/灰色模式的滤镜链，见 `@antdv/design` 的 a11y.css */
export const APP_FILTER = '--app-filter';
/**
 * 根字号，写成相对浏览器默认值的百分比而不是 px。
 * rem 体系的间距、行高、尺寸都跟着根字号缩放，写死 px 反而会让"文字变小了、盒子没变"。
 */
export const APP_FONT_SIZE = '--app-font-size';
/**
 * 自定义主色才写这条。预设主题的颜色由 token 文件里完整的 `[data-theme]` 色板给出，
 * 内联一个 `--app-primary` 反而会把暗色档辛苦提亮的那版主色又压回亮色值。
 */
export const APP_PRIMARY = '--app-primary';

/**
 * 偏好写下的主题档位标记（`<html data-theme="violet">`）。
 * 名字与 `@antdv/design` token 文件里的 `[data-theme='x']` 块是同一份名单，
 * 取值见 `./theme-presets`。
 */
export const THEME_DATA_ATTRIBUTE = 'data-theme';

/** 偏好写下的全部变量，`clearPreferencesFromDom` 按这份名单移除 */
export const PREFERENCE_CSS_VARS = [
  APP_BORDER_RADIUS,
  APP_FILTER,
  APP_FONT_SIZE,
  APP_PRIMARY,
] as const;
