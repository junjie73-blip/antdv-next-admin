/**
 * 应用侧的加载相关薄壳。
 *
 * 通用的 Loading 组件、函数式实例与 `v-loading` 指令已经抽到 `@antdv/ui`；
 * 这里只留下两个"必须读 app store 或 vue-router"的壳，
 * 因为把它们放进包里就等于让包依赖 pinia / 路由，边界会立刻糊掉。
 *
 * - `PageLoading`：路由级占位，明暗跟随偏好设置
 * - `RouteLoadingBar`：顶部进度条，读取 `showProgressBar` 等偏好
 */
export { default as PageLoading } from './PageLoading.vue';
export { default as RouteLoadingBar } from './RouteLoadingBar.vue';
