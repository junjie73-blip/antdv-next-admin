/**
 * `@antdv/layouts` —— 布局装配层。
 *
 * 职责边界：这里回答"这一层该放什么"——七种形态的区域蓝图、内容区宽度策略、
 * 菜单树状态源、面包屑推导与渲染、外壳装配（`basic/`）、把偏好与 store 接到壳上的
 * 行为 hook（`hooks/`）、顶栏小部件（`widgets/`）；
 * "放上去长什么样"（Header / Sidebar / NavRail / Tabbar / Content / Footer 的
 * 类名、DOM 契约与尺寸常量）在 `@antdv/layout-ui`。
 *
 * 依赖方向是单向的：本包读 layout-ui 的渲染件、契约与 `@antdv/stores` 的会话状态，
 * layout-ui 反过来谁也不读上层（不碰 pinia / vue-router）。
 * 本包**可以**读 store（它就是应用外壳），但**不** import vue-i18n：
 * 文案与菜单译文一律由宿主经 `configureLayout({ t, translateMenu })` 注入（函数住在
 * layout-ui），品牌图标与产品名走 props —— 换一套语言包或换个 logo 不用动这里。
 *
 * 为什么值得单独成包：7 种形态 × 内容区流式/定宽 × 标签页最大化这些组合，
 * 如果散在模板里 `v-if="layout === 'xxx'"`，加一种形态就要改一遍所有组件；
 * 收敛成一张区域蓝图（`LAYOUT_BLUEPRINTS`）后，新增形态只加一行表项。
 */

export { default as PageLoading } from './basic/content/page-loading.vue';

export { default as PageTransition } from './basic/content/page-transition.vue';
export { default as RouteLoadingBar } from './basic/content/route-loading-bar.vue';
// 外壳与它的几个零件：宿主只需要 `BasicLayout` + logo/标题 + 顶栏插槽
export { default as BasicLayout } from './basic/layout.vue';
export { default as LayoutTabs } from './basic/tabbar/index.vue';
export * from './breadcrumb';

export * from './content';
export * from './hooks/use-header-menu';
export * from './hooks/use-layout';
export * from './hooks/use-menu-tree';
export * from './hooks/use-page-cache';
export * from './hooks/use-sidebar-menu';
export * from './hooks/use-tabs';

export * from './host';
export * from './menu-search';
export * from './menu-source';
export * from './modes';
// 住在装配层的组件：面包屑（依赖上面的推导函数）、命令面板与布局形态示意图
export { default as LayoutBreadcrumb } from './widgets/breadcrumb.vue';

/*
 * 明暗开关与语言开关单独导出：认证页（登录/注册）在布局外壳之外，
 * 但右上角那颗工具条要用同一套控件 —— 复制一份就会分叉（文案、偏好写侧各一套）。
 */
export { default as LayoutWidgetColorToggle } from './widgets/color-toggle/index.vue';
export { default as LayoutGlobalSearch } from './widgets/global-search/index.vue';
export { default as LayoutWidgetLanguageToggle } from './widgets/language-toggle/index.vue';
export {
  DEFAULT_ICON_PALETTE,
  resolveIconPalette,
} from './widgets/layout-icon-palette';
export type {
  IconPaletteSet,
  LayoutIconPalette,
} from './widgets/layout-icon-palette';
export { default as LayoutIcon } from './widgets/layout-icon.vue';
export {
  LAYOUT_ICON_FALLBACK,
  LAYOUT_ICON_SHAPES,
  LAYOUT_ICON_VIEWBOX,
  layoutIconRects,
} from './widgets/layout-icons';
export type {
  IconFillSlot,
  IconRect,
  LayoutIconType,
} from './widgets/layout-icons';
// 顶栏右侧那一排：宿主薄壳只需要摆这两个（小部件的可见性由偏好开关决定）
export { default as LayoutUserDropdown } from './widgets/user-dropdown/index.vue';
export { default as LayoutWidgetBar } from './widgets/widget-bar.vue';
export type { ContentMode, LayoutMode } from '@antdv/types';
