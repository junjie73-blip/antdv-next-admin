/**
 * `@antdv/directives` —— 可复用的 Vue 指令集合。
 *
 * 设计约束（与 `@antdv/router`、`@antdv/preferences` 一致）：
 * 包内不 import pinia / store / vueuse / `import.meta.env`。
 * 「谁有权限」「浏览器 API 长什么样」都由应用注入，
 * 所以同类型的中后台项目可以直接复用，不必先改包。
 */

export * from './lazy';
export * from './permission';
