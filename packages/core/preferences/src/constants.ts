
/**
 * 偏好域的固定字面量。
 *
 * 只放"改了就会影响既有数据/既有样式"的名字：缓存键与 `dark` class 都有盘上/
 * CSS 侧的对应物，写在包里而不是应用侧，是为了让"写侧"（本包）与"读侧"
 * （`@antdv/design` 的 a11y.css、Tailwind 的 custom-variant）拿同一个字符串。
 */

/** 沿用历史键：改名会让老用户的设置凭空消失 */
export const PREFERENCES_CACHE_KEY = 'appSetting';

/**
 * 首屏主题快照的缓存键（真实键名还要叠上 `buildStorageKey` 的前缀）。
 *
 * 它与 `appSetting` **必须是两条**：那份是加密的完整偏好，而读它的是
 * `vite-plugin-app-loading` 注入在 `<head>` 里的内联脚本 —— 脚本跑在应用代码之前，
 * 既没有解密能力（密钥按环境注入），也不该拿到全部设置。
 * 这里只写"首屏画对颜色所需"的三五个字段，明文落盘。
 */
export const BOOT_THEME_CACHE_KEY = 'bootTheme';

/** 缺省的深色 class 名，Tailwind `@custom-variant dark` 与应用注入的那份同源 */
export { DARK_CLASS as DEFAULT_DARK_CLASS } from '@antdv/shared/constants';

/** 色弱模式：官方推荐写法（invert + grayscale），与 design 的 a11y.css 同一条滤镜 */
export const COLOR_WEAK_FILTER = 'invert(80%) grayscale(100%)';

/** 灰色模式 */
export const GRAY_MODE_FILTER = 'grayscale(100%)';
