/**
 * layout-ui 对外入口。
 *
 * 边界（刻意不做什么）：这里只有"放上去长什么样"的渲染件 —— 外壳、五个区域、
 * 侧栏的小部件、两个 hook、渲染契约（含外壳尺寸）与 aria-label 文案的注入点
 * `configureLayout`。
 * "这一层该放什么"（七种形态的区域蓝图、内容区宽度、面包屑推导）与布局形态
 * 示意图组件住在 `@antdv/layouts`；菜单数据、路由、偏好设置由宿主交进来。
 *
 * 尺寸与文案注入点为什么在渲染层而不是装配层：依赖方向是 `layouts → layout-ui`，
 * 壳要用这两样东西，让它们反过来住上层就成环了。
 */

// 各区域
export { default as LayoutContent } from './components/layout-content/index.vue';

export { default as LayoutFooter } from './components/layout-footer/index.vue';
export { default as LayoutHeader } from './components/layout-header/index.vue';
export { default as LayoutSidebar } from './components/layout-sidebar/index.vue';
export { default as LayoutNavRail } from './components/layout-sidebar/nav-rail.vue';
export { default as LayoutOverlay } from './components/layout-sidebar/overlay.vue';
export { default as LayoutTabbar } from './components/layout-tabbar/index.vue';
// 侧栏小部件
export { default as SidebarCollapsedButton } from './components/widgets/sidebar-collapsed-button/index.vue';

// 排版（明暗 / 极客 / 深色侧栏 / 深色顶栏四档的全部类名）与侧栏拖拽
export { useLayoutStyle } from './hooks/use-layout';

export type { LayoutStyleApi } from './hooks/use-layout';
export { useSidebarDrag } from './hooks/use-sidebar-drag';

export type {
  SidebarDragApi,
  SidebarDragOptions,
} from './hooks/use-sidebar-drag';
// 渲染契约：区域与输入的类型、外壳尺寸常量、多语言注入点
export * from './layout';

// 外壳
export { default as LayoutShell } from './layout.vue';
