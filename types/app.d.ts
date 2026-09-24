import type { ConfigProviderProps, MappingAlgorithm } from "antdv-next";

export type ThemeMode = "light" | "dark" | "auto";
export type ComponentSize = ConfigProviderProps["componentSize"];
export type LayoutMode = "vertical" | "horizontal" | "mixed";
export type NotificationPosition = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
export type TransitionEffect =
  | "fade"
  | "slide"
  | "slide-right"
  | "slide-left"
  | "slide-up"
  | "slide-down"
  | "zoom"
  | "fade-slide"
  | "scale"
  | "flip";
export type RouteMode = "frontend" | "backend";

export type ThemeStyle =
  | "default"
  | "dark"
  | "compact"
  | "mui"
  | "shadcn"
  | "cartoon"
  | "illustration"
  | "bootstrap"
  | "skeuomorphism"
  | "glass"
  | "geek";

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
  showTabs: boolean;
  tabShowIcon: boolean;
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
}
