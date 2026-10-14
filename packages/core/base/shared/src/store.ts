/**
 * 响应式 store 原语：只允许转发 `@tanstack/vue-store`。
 *
 * 单独给一个入口是为了让"跨组件共享状态"这件事只有一种写法——
 * 项目的 store（tabbar / timezone / access / preferences）都建立在
 * `useStore` + `useAtom` 之上，出现第二套（自建 ref 单例、pinia）就要在
 * 这里加适配层，而不是在业务侧各写各的。
 *
 * 类型（`Store`、`StoreOptions` 等）由 `@tanstack/vue-store` 自身 re-export
 * 自 `@tanstack/store`，这里不再单独列。
 */
export * from '@tanstack/vue-store';
