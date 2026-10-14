/**
 * 偏好写到 DOM 上的 CSS 变量名。
 *
 * 这些名字是"写侧"（`@antdv/preferences` 的 applyPreferencesToDom）与
 * "读侧"（`@antdv/design` 的 token、各组件里的 `var()`）之间的契约。
 * 名字散在两处维护，改名时不会报错，只会变成"写了新变量、样式还在读旧变量"
 * 的静默失效，所以统一由这里给出。
 */

/** antdv-next 运行时注入的主色命名（组件里 39 处在用） */
export const ANT_COLOR_PRIMARY = '--ant-color-primary';
/** 主色的旧命名，进度条等几处仍在读，改主色时要一起写 */
export const ANT_PRIMARY_COLOR = '--ant-primary-color';
export const ANT_BORDER_RADIUS = '--ant-border-radius';
export const ANT_FONT_SIZE = '--ant-font-size';

/** 应用侧命名，由 `@antdv/design` 的 token 消费 */
export const APP_BORDER_RADIUS = '--app-border-radius';
export const APP_FILTER = '--app-filter';
export const APP_FONT_SIZE = '--app-font-size';
export const APP_SIDEBAR_WIDTH = '--app-sidebar-width';

/** 偏好写下的全部变量，`clearPreferencesFromDom` 按这份名单移除 */
export const PREFERENCE_CSS_VARS = [
  ANT_COLOR_PRIMARY,
  ANT_PRIMARY_COLOR,
  ANT_BORDER_RADIUS,
  ANT_FONT_SIZE,
  APP_BORDER_RADIUS,
  APP_FONT_SIZE,
  APP_SIDEBAR_WIDTH,
  APP_FILTER,
] as const;
