/**
 * 布局尺寸常量。
 *
 * 这些数字同时被三处消费：模板里的 inline style、CSS 变量、以及计算
 * "内容区可视高度"（滚动定位、吸顶偏移）的 composable。写死在组件里
 * 迟早会出现 48 与 56 并存的那类 bug，所以只在这里定义一次。
 */

/** 顶栏那一行的实际渲染高度（56px）；模板里请用下面的 `LAYOUT_HEADER_ROW_STYLE` */
export const LAYOUT_HEADER_HEIGHT = 56;
export const LAYOUT_TABS_HEIGHT = 40;
export const LAYOUT_FOOTER_HEIGHT = 32;

/**
 * 顶栏那一行的尺寸，唯一来源。
 *
 * 为什么是 inline style 而不是继续写 `h-14`：antd 的 `.ant-layout-header` 自带
 * `height: 64px; line-height: 64px`，和 Tailwind 的 `.h-14` 特异性相同（都是一个类），
 * 谁在样式表后面谁赢 —— 而 cssinjs 是运行时注入到 `<head>` 末尾的，于是顶栏实测 64px、
 * 侧栏 Logo 区实测 56px，垂直模式下两者错开 8px（用户报的"Logo 区域高度要和顶栏对齐"）。
 * inline style 压过一切，且顶栏 / 侧栏 Logo / 图标栏 Logo / 横向菜单滚动条四处
 * 都从这里取值，不会再各写各的。
 */
export const LAYOUT_HEADER_ROW_STYLE: { height: string; lineHeight: string } = {
  height: `${LAYOUT_HEADER_HEIGHT}px`,
  lineHeight: `${LAYOUT_HEADER_HEIGHT}px`,
};

/** 主侧边栏展开宽度（偏好项 `sidebarWidth` 的默认值） */
export const LAYOUT_SIDEBAR_WIDTH = 210;
export const LAYOUT_SIDEBAR_MIN_WIDTH = 160;
export const LAYOUT_SIDEBAR_MAX_WIDTH = 320;
/** 主栏折叠宽度：只留图标，与应用此前的 64px 视觉一致 */
export const LAYOUT_SIDEBAR_COLLAPSED_WIDTH = 64;

/** 双列形态的图标栏：展开只放图标，收起后进一步缩窄 */
export const LAYOUT_RAIL_WIDTH = 68;
export const LAYOUT_RAIL_COLLAPSED_WIDTH = 48;

/** 侧边导航抽屉宽度（浮层，不参与内容区宽度计算） */
export const LAYOUT_DRAWER_WIDTH = 260;

/**
 * 窄屏断点（px）。
 * 小于该宽度时，常驻侧栏改为浮层抽屉，避免 210px 把内容区挤没；
 * 与 Tailwind 的 `md` 前缀保持一致，模板里写 `md:flex` 时才不会出现"两边判断不一致"。
 */
export const MOBILE_BREAKPOINT = 768;

export const LAYOUT_HEADER_AND_TABS_HEIGHT =
  LAYOUT_HEADER_HEIGHT + LAYOUT_TABS_HEIGHT;

/** 顶栏 + 标签页 + 底栏同时存在时的总外壳高度 */
export const LAYOUT_CHROME_HEIGHT =
  LAYOUT_HEADER_AND_TABS_HEIGHT + LAYOUT_FOOTER_HEIGHT;

/** 外壳高度：内容全屏形态下为 0，其余按开关累加 */
export function resolveChromeHeight(options: {
  footer?: boolean;
  header?: boolean;
  tabs?: boolean;
}): number {
  const { footer = true, header = true, tabs = true } = options;
  return (
    (header ? LAYOUT_HEADER_HEIGHT : 0) +
    (tabs ? LAYOUT_TABS_HEIGHT : 0) +
    (footer ? LAYOUT_FOOTER_HEIGHT : 0)
  );
}

/**
 * 侧边区域总宽（主栏 + 图标栏），供 CSS 变量与滚动定位使用。
 * 折叠只影响主栏，图标栏恒定。
 */
export function resolveSidebarWidth(options: {
  collapsed?: boolean;
  rail?: boolean;
  railWidth?: number;
  sidebarWidth?: number;
}): number {
  const {
    collapsed = false,
    rail = false,
    railWidth = LAYOUT_RAIL_WIDTH,
    sidebarWidth = LAYOUT_SIDEBAR_WIDTH,
  } = options;
  const main = collapsed ? LAYOUT_SIDEBAR_COLLAPSED_WIDTH : sidebarWidth;
  return rail ? main + railWidth : main;
}
