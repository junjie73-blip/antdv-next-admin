import type { ConfigProviderProps, ThemeConfig } from 'antdv-next';

/**
 * antd 主题算法：单个派生函数，或算法数组（如 `[darkAlgorithm, compactAlgorithm]`）。
 *
 * `antdv-next` 只在 `theme` 子模块里导出 `MappingAlgorithm`（单函数版），
 * 根入口没有，从根导入会直接 TS2614；这里直接从 `ThemeConfig` 派生，
 * 覆盖 antd 允许的全部写法，换 antdv 版本时只改这一行。
 */
export type ThemeAlgorithm = NonNullable<ThemeConfig['algorithm']>;

export type ThemeMode = 'auto' | 'dark' | 'light';
export type ComponentSize = ConfigProviderProps['componentSize'];

/**
 * 布局形态（7 种，语义见 `@antdv/layouts` 的区域蓝图）。
 *
 * 只在这里定义"有哪些形态"，"每种形态长什么样"（顶栏放导航还是面包屑、
 * 侧边栏出不出图标栏）属于布局包的职责。
 *
 * 历史值：`'mixed'` 已重命名为 `'mixed-vertical'`，旧缓存由
 * `normalizeLayoutMode()` 在读偏好时迁移，不入库。
 */
export type LayoutMode =
  | 'full-content'
  | 'horizontal'
  | 'mixed-two-column'
  | 'mixed-vertical'
  | 'side-nav'
  | 'two-column'
  | 'vertical';

/**
 * 内容区宽度策略
 * - full：流式，跟随视口
 * - fixed：定宽，超宽屏居中留白
 */
export type ContentMode = 'fixed' | 'full';

export type NotificationPosition =
  | 'bottomLeft'
  | 'bottomRight'
  | 'topLeft'
  | 'topRight';
export type TransitionEffect =
  | 'fade'
  | 'fade-slide'
  | 'flip'
  | 'scale'
  | 'slide'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'zoom';
export type RouteMode = 'backend' | 'frontend';

/**
 * 标签页视觉风格
 * - card：卡片（带边框与圆角，选中态填充主色）
 * - chrome：谷歌风格（顶部圆角的浏览器标签，选中页用内容底色浮起）
 * - rounded：胶囊圆角
 * - line：下划线（极简，仅底部指示条）
 * - plain：纯文字 + 分隔线
 */
export type TabStyle = 'card' | 'chrome' | 'line' | 'plain' | 'rounded';

export type ThemeStyle =
  | 'bootstrap'
  | 'cartoon'
  | 'compact'
  | 'dark'
  | 'default'
  | 'geek'
  | 'glass'
  | 'illustration'
  | 'mui'
  | 'shadcn'
  | 'skeuomorphism';

export interface ThemePreset {
  name: string;
  label: string;
  algorithm?: ThemeAlgorithm;
  token?: Record<string, unknown>;
  components?: Record<string, Record<string, unknown>>;
}

export interface AppSetting {
  /* ---------- 主题 ---------- */
  theme: ThemeMode;
  themeStyle: ThemeStyle;
  primaryColor: string;
  /** 圆角倍率：0 / 0.25 / 0.5 / 0.75 / 1 */
  borderRadius: number;
  /** 基础字号（px） */
  fontSize: number;
  darkSidebar: boolean;
  darkHeader: boolean;
  colorWeak: boolean;
  grayMode: boolean;

  /* ---------- 布局 ---------- */
  layout: LayoutMode;
  /** 内容区宽度策略：流式 / 定宽 */
  contentMode: ContentMode;
  /** contentMode 为 fixed 时的最大宽度（px） */
  contentWidth: number;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  /** 双列菜单 / 混合双列的图标栏宽度（px） */
  railWidth: number;
  /** 窄屏下浮层菜单（抽屉）的开合状态 */
  sidebarOverlayOpen: boolean;
  /** 菜单手风琴：仅展开一个子菜单 */
  menuAccordion: boolean;
  /** 横向导航栏溢出时横向滚动（关闭则回退为 antd 的「···」折叠） */
  headerMenuScroll: boolean;
  showTabs: boolean;
  tabShowIcon: boolean;
  /** 标签页视觉风格 */
  tabStyle: TabStyle;
  /** 允许拖拽排序标签页 */
  tabDragSort: boolean;
  /** 启用标签页右键菜单 */
  tabContextMenu: boolean;
  showBreadcrumb: boolean;
  hideBreadcrumbWhenOnlyOne: boolean;
  showBreadcrumbIcon: boolean;

  /* ---------- 小部件 ---------- */
  widgetNotice: boolean;
  widgetFullscreen: boolean;
  widgetTheme: boolean;
  widgetTimezone: boolean;
  widgetLogout: boolean;
  widgetSearch: boolean;
  widgetPreferences: boolean;

  /* ---------- 底栏 ---------- */
  showFooter: boolean;
  showCopyright: boolean;
  copyrightCompany: string;
  copyrightIcp: string;

  /* ---------- 通用 ---------- */
  componentSize: ComponentSize;
  timezone: string;
  enableWatermark: boolean;
  watermarkContent: string;
  enableWaterRipple: boolean;
  notificationPosition: NotificationPosition;
  transitionEffect: TransitionEffect;
  /** 页面切换进度条 */
  showProgressBar: boolean;
  locale: string;
  /** 页面切换 Loading */
  showLoading: boolean;
  routeMode: RouteMode;
}
