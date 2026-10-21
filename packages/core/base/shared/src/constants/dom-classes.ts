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
/**
 * 主题作用域容器：`ConfigProvider` 挂在它自己那个 `display: contents` 宿主上。
 *
 * 存在的理由是 shadcn 规范名别名层（`@antdv/design` 的 `token/index.css`）。
 * 那批无前缀变量（`--background` / `--primary` …）是按"在同一个元素上把
 * `--app-*` 换出来"实现的，只在 `<html>` 上声明一次的话，
 * `ConfigProvider` 在子树里覆盖的 `--app-primary` 就染不到它们 ——
 * 加上这个类，别名层会在每个作用域容器上重算一遍。
 */
export const THEME_SCOPE_CLASS = 'app-theme-scope';
