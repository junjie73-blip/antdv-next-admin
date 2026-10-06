import type { ConfigProviderProps, MappingAlgorithm } from 'antdv-next';

export type ThemeMode = 'auto' | 'dark' | 'light';
export type ComponentSize = ConfigProviderProps['componentSize'];
export type LayoutMode = 'horizontal' | 'mixed' | 'vertical';
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
 * - rounded：胶囊圆角
 * - line：下划线（极简，仅底部指示条）
 * - plain：纯文字 + 分隔线
 */
export type TabStyle = 'card' | 'line' | 'plain' | 'rounded';

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
  algorithm?: MappingAlgorithm;
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
  sidebarCollapsed: boolean;
  sidebarWidth: number;
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
