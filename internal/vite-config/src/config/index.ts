/**
 * 配置分层（对齐 Vben 的 `internal/vite-config/src/config`）：
 *
 * - `common`     ：任何构建目标都要的部分（别名、dedupe、缓存目录、CSS sourcemap）
 * - `application`：SPA —— 插件装配、dev server + Mock 代理、分包与压缩
 * - `library`    ：组件库 / 工具库的 lib 模式 —— external、dts、不压缩
 *
 * 三者是「叠加」关系：`defineXxxConfig()` 内部先取 common，再叠自己的目标配置，
 * 最后叠调用方传来的 `overrides`，所以项目专属差异永远留在应用侧，不必改包。
 */
export * from './application';
export * from './common';
export * from './library';
