import type { BreadcrumbItem } from '@antdv/layouts';
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

/** 面包屑住在哪一行：顶栏里，还是内容列的第一行 */
export type BreadcrumbVariant = 'content' | 'header';

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

/** 面包屑的输入 */
export interface LayoutBreadcrumbConfig {
  /** 偏好总开关（关掉时整条不渲染） */
  enabled?: boolean;
  /** 只有一级时不显示 */
  hideWhenOnlyOne?: boolean;
  /** 数据来源是 `@antdv/layouts` 的面包屑项，和菜单树共用一套推导 */
  items: BreadcrumbItem[];
  /**
   * path → 可点击链接。
   *
   * 必须在使用方生成：hash / history 模式下的 href 由 router.resolve 决定，
   * 包内不 import vue-router，所以这里只接一个函数。缺省时不输出链接（纯文本）。
   */
  resolveHref?: (path: string) => string | undefined;
  showIcon?: boolean;
  /** 住在顶栏里还是内容列第一行（Logo 系形态没有落脚点，只能另起一行） */
  variant?: BreadcrumbVariant;
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
