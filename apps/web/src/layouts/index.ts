/**
 * 布局目录的出口。
 *
 * 外壳本体、行为 hook、区域组件与顶栏小部件都进了 `@antdv/layouts`（渲染件在
 * `@antdv/layout-ui`）；`vite-plugin-vue-layouts-next` 要求这里保留按目录约定取用的
 * 默认布局，也就是 `./index.vue` 那一层薄壳（品牌资源与字典）。
 */
export { default as DefaultLayout } from './index.vue';
