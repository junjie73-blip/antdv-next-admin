/**
 * `@antdv/utils` —— 与框架无关的纯函数。
 *
 * 边界（刻意不做什么）：
 * - 不依赖 pinia / vue-router 运行时（`menu.ts` 只 `import type` 路由记录）；
 * - 不持有偏好状态，也不写 DOM：状态与"把状态落到 CSS 变量 / class"都在
 *   `@antdv/preferences`；
 * - 不做请求、不写 cookie。
 *
 * 用显式 `export *`：两个模块导出同名成员时 TS 直接报 TS2308，比在业务侧
 * "导入到 undefined"更早暴露。
 */

export * from './menu';
export * from './theme-mode';
