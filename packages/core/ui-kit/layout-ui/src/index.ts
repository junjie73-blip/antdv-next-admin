/**
 * layout-ui 对外入口。
 *
 * 只暴露"装配用的壳 + 可复用的区域组件 + 配色/图示的计算函数"，
 * 区域开关（`useLayoutRegions`）、蓝图与面包屑推导留在 `@antdv/layouts`：
 * 那边是"这一层该放什么"的模型，这边是"放上去长什么样"的渲染。
 */

// 外壳与各区域
export { default as LayoutBreadcrumb } from './components/LayoutBreadcrumb.vue';
export { default as LayoutContent } from './components/LayoutContent.vue';
export { default as LayoutFooter } from './components/LayoutFooter.vue';
export { default as LayoutHeader } from './components/LayoutHeader.vue';
export { default as LayoutIcon } from './components/LayoutIcon.vue';
export { default as LayoutNavRail } from './components/LayoutNavRail.vue';
export { default as LayoutOverlay } from './components/LayoutOverlay.vue';
export { default as LayoutShell } from './components/LayoutShell.vue';
export { default as LayoutSider } from './components/LayoutSider.vue';

// 运行时配置（aria-label / 退出入口文案的注入点）
export { configureLayout, layoutRuntime } from './config';
export type { LayoutTranslateFn, LayoutUIRuntime } from './config';

// 示意图：图形数据表与调色板
export {
  DEFAULT_ICON_PALETTE,
  resolveIconPalette,
} from './layout-icon-palette';
export type {
  IconPaletteSet,
  LayoutIconPalette,
} from './layout-icon-palette';
export {
  LAYOUT_ICON_FALLBACK,
  LAYOUT_ICON_SHAPES,
  LAYOUT_ICON_VIEWBOX,
  layoutIconRects,
} from './layout-icons';
export type {
  IconFillSlot,
  IconRect,
  LayoutIconType,
} from './layout-icons';

export type {
  BreadcrumbVariant,
  HeaderLead,
  LayoutBreadcrumbConfig,
  LayoutContentStyle,
  LayoutFooterConfig,
  LayoutNavConfig,
  LayoutOverlayConfig,
  LayoutRailConfig,
  LayoutRegion,
  LayoutShellRegions,
  LayoutSiderConfig,
  LayoutTone,
} from './types';
// 排版（明暗 / 极客 / 深色侧栏 / 深色顶栏四档的全部类名）
export { useLayoutStyle } from './useLayoutStyle';

export type { LayoutStyleApi } from './useLayoutStyle';
