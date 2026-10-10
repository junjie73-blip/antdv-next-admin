/**
 * `@antdv/layouts` —— 布局模型层。
 *
 * 职责边界：这里只有"布局应该长什么样"的描述与派生逻辑，没有 SFC，也不碰
 * pinia / vue-router 的实现。外壳组件（`apps/web/src/layouts`）负责把这些
 * 开关落到 DOM 上，菜单数据、路由、偏好设置全部由宿主注入。
 *
 * 为什么值得单独成包：7 种形态 × 内容区流式/定宽 × 标签页最大化这些组合，
 * 如果散在模板里 `v-if="layout === 'xxx'"`，加一种形态就要改一遍所有组件；
 * 收敛成一张区域蓝图（`LAYOUT_BLUEPRINTS`）后，新增形态只加一行表项。
 */

export * from './breadcrumb';

export * from './constants';
export * from './content';
export * from './menu-source';
export * from './modes';
export type { ContentMode, LayoutMode } from '@antdv/types';
