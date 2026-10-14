/**
 * 偏好开关落在 `<html>` 上的 class 名。
 *
 * 判定条件（`preferences.colorWeak`）在 `@antdv/preferences`，样式规则在
 * `@antdv/design/css/a11y.css`，两边只能靠字符串对齐；把名字收到一处常量里，
 * 至少写侧的两处（apply 与 clear）不会各写各的。
 */

/** 深色模式 class，Tailwind 的 `@custom-variant dark (&:where(.dark, .dark *))` 依赖它 */
export const DARK_CLASS = 'dark';
/** 色弱模式：invert + grayscale 滤镜 */
export const COLOR_WEAK_CLASS = 'color-weak';
/** 灰色模式：grayscale 滤镜 */
export const GRAY_MODE_CLASS = 'gray-mode';
