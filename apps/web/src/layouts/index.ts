/**
 * 布局目录的出口。
 *
 * 区域组件（Header / Sider / NavRail / Breadcrumb / Footer / Shell 本体）已经进了
 * `@antdv/layout-ui`，这里只剩应用自己的两样东西：装配好的默认布局，和把偏好
 * 与 store 接到壳上的 `LayoutTabs`（内部渲染来自 `@antdv/tabs-ui`）。
 */
export { default as LayoutTabs } from './components/LayoutTabs.vue';
export * from './composables/useLayout';

export { default as DefaultLayout } from './index.vue';
