/**
 * 布局外壳的渲染契约。
 *
 * 这一层是**依赖图的底**：`@antdv/layouts`（装配层）读这里，这里谁也不读装配层，
 * 否则包级别就转成环了。所以除了接口，外壳自己要用却又属于"契约"的两样东西
 * 也住在这里：
 * - 尺寸常量（`LAYOUT_*`）：DOM 契约的一部分，端到端用例与样式覆盖都按这些数字断言；
 * - 文案注入点（`layoutRuntime` / `configureLayout`）：让壳不依赖具体应用的多语言实现。
 *
 * 这些接口是包与宿主之间的**边界**：宿主交出算好的开关与数据（蓝图来自
 * `@antdv/layouts`，偏好来自宿主自己的 store），包只负责把它们画成 DOM。
 * 因此这里不出现 pinia / vue-router / vue-i18n 的类型，href 之类必须依赖
 * 路由模式的值一律以"函数"的形式注入。
 *
 * 面包屑的契约不在这里：`LayoutBreadcrumbConfig` 随组件住在 `@antdv/layouts`，
 * 外壳只通过 `#breadcrumb` 插槽告诉它"这一格画在顶栏还是内容列"。
 */

import type { MenuConfig, MenuKey } from '@antdv/types';

/**
 * `data-layout-region` 的取值集合。
 *
 * 这一串字符串不是内部实现细节：端到端用例、样式覆盖、第三方主题都靠它定位外壳区域
 * （迁移前 antd 的 `.ant-layout-sider` 之类是组件库的私有类名，换成自绘壳之后
 * 必须由我们自己给出稳定契约）。
 */
export type LayoutRegion =
  | 'breadcrumb'
  | 'content'
  | 'footer'
  | 'header'
  | 'header-nav'
  | 'nav-rail'
  | 'sidebar';

/** 顶栏左侧放什么，取值与 `@antdv/layouts` 蓝图的 `headerLead` 一致 */
export type HeaderLead = 'breadcrumb' | 'logo';

/**
 * 外壳配色输入。
 *
 * 三个开关必须分开：`dark` 是「当前是深色模式」，`sidebarDark` 是偏好里的
 * 「深色侧栏」（浅色模式下也想要深色左列），`geek` 是极客风格（固定深色 + 荧光绿，
 * 不跟随明暗）。迁移前它们在组件里各写一遍三元表达式，加一个风格就要全改。
 */
export interface LayoutTone {
  dark?: boolean;
  geek?: boolean;
  /** 偏好里的「深色顶栏」：浅色模式下也想要深色那一行 */
  headerDark?: boolean;
  /** 偏好里的「深色侧栏」：浅色模式下也想要深色左列 */
  sidebarDark?: boolean;
}

/** 侧栏（常驻那一列）的输入 */
export interface LayoutSiderConfig {
  collapsed?: boolean;
  /** 缺图标的项也占一个图标位，保证一列文字左边缘对齐 */
  keepIconSlot?: boolean;
  logo?: string;
  menus: MenuConfig[];
  /** 受控展开集：手风琴与路由定位策略留在使用方，包内不自己记 */
  openKeys?: MenuKey[];
  /** 浮层模式（抽屉 / 窄屏）：不折叠、不加底部折叠条，宽度用抽屉宽度 */
  overlay?: boolean;
  selectedKeys?: MenuKey[];
  showLogo?: boolean;
  title?: string;
  tone?: LayoutTone;
  /** 展开宽度（偏好项 `sidebarWidth`） */
  width?: number;
}

/** 图标栏（双列形态的第一列）的输入 */
export interface LayoutRailConfig {
  activeKey?: MenuKey;
  logo?: string;
  menus: MenuConfig[];
  title?: string;
  tone?: LayoutTone;
  width?: number;
}

/** 顶栏横向导航的输入 */
export interface LayoutNavConfig {
  /** 要滚进可视区的那一项 */
  activeKey?: MenuKey;
  /** 只渲染到该深度：混合形态传 1，水平形态传 Infinity */
  maxDepth?: number;
  menus: MenuConfig[];
  /** 关闭后退化为原生横向滚动，不渲染箭头 */
  scrollable?: boolean;
  selectedKeys?: MenuKey[];
  tone?: LayoutTone;
  withChildren?: boolean;
}

/** 底栏的输入 */
export interface LayoutFooterConfig {
  company?: string;
  companyHref?: string;
  icp?: string;
  icpHref?: string;
  showCopyright?: boolean;
  /** 年份：默认取当前年，单测里显式传值才不会随日期漂移 */
  year?: number;
}

/** 外壳的区域开关，取自 `@antdv/layouts` 的蓝图 + 使用方的偏好 */
export interface LayoutShellRegions {
  /** 底栏（还要 `&& showFooter` 由使用方先算好） */
  footerVisible: boolean;
  headerLead: HeaderLead;
  headerNavVisible: boolean;
  headerVisible: boolean;
  navRailVisible: boolean;
  /** 常驻侧栏在该形态下改为浮层（窄屏或蓝图声明为 drawer） */
  overlaySidebar: boolean;
  /** 内容全屏 / 标签页放大：只留内容区 */
  shellHidden: boolean;
  sidebarVisible: boolean;
  /** 标签页栏（还要 `&& showTabs` 由使用方先算好） */
  tabsVisible: boolean;
}

/**
 * 内容区宽度策略的行内样式（`resolveContentStyle` 的产物）。
 *
 * 声明成样式记录而不是具名类型：`ContentStyle` 的字段都是可选的，
 * 值域因此带 `undefined`，这里照单收下，绑定到 `:style` 时才不会被
 * Vue 的 `StyleValue` 判成不兼容。
 */
export type LayoutContentStyle = Record<string, string | undefined>;

/** 浮层抽屉的输入 */
export interface LayoutOverlayConfig {
  open: boolean;
  width?: number;
}

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

/**
 * 运行时注入点：让外壳不依赖具体应用的多语言实现。
 *
 * 折叠按钮、横向导航箭头、「退出内容全屏」这些控件只有 aria-label 与 tooltip
 * 需要文案。包内不引 vue-i18n，改成注入 `t`（与 tabs-ui / menu-ui 同一套约定）：
 * - 默认实现原样返回 key，单测与没配 i18n 的接入方仍能渲染出稳定文本；
 * - 应用启动时 `configureLayout({ t, translateMenu })` 换成真实现。
 *
 * key 沿用应用既有的命名空间（`header.*` / `shell.*` / `menu.*`），这样接入时不用改语言包，
 * 端到端用例里那句 `[aria-label="收起菜单"]` 也照旧命中。
 *
 * 读 `layoutRuntime.t` 必须是调用时才读（不要在模块顶层固化字符串），
 * 语言切换才会成为消费方 computed 的依赖。
 */

export type LayoutTranslateFn = (
  key: string,
  named?: Record<string, number | string>,
) => string;

export interface LayoutUIRuntime {
  t: LayoutTranslateFn;
  /**
   * 菜单标题的译文查找：返回 `undefined` 表示文案表里没有这一条，
   * 由 `localizeMenus` 回退成后端原文。
   *
   * 单独一个口子而不是复用 `t`，是因为 vue-i18n 里"有没有这个键"要问 `te`，
   * 而 `t` 查不到时返回的是 key 本身 —— 直接喂给 `t` 会让导航显示 `menu.NewPage`。
   */
  translateMenu: (key: string) => string | undefined;
}

export const layoutRuntime: LayoutUIRuntime = {
  t: (key: string) => key,
  translateMenu: () => undefined,
};

/** 应用启动时调用一次，注入自己的翻译函数 */
export function configureLayout(options: Partial<LayoutUIRuntime>): void {
  Object.assign(layoutRuntime, options);
}

/**
 * 组件里的 `t`：写法与 `useI18n()` 一致，来源是注入的函数。
 *
 * 返回的闭包在**调用时**才读 `layoutRuntime`，所以语言切换（i18n 的 locale 是
 * 响应式的）会成为消费方 computed / 渲染的依赖，而不是一次性定格的字符串。
 */
export function useLayoutI18n(): { t: LayoutTranslateFn } {
  return { t: (key, named) => layoutRuntime.t(key, named) };
}
