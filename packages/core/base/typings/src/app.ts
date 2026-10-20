/**
 * 组件尺寸词汇。
 *
 * `middle` 是 `medium` 的旧别名：历史偏好缓存里存的是它，删掉这个值会让
 * `pickKnownPreferences` 在恢复缓存时丢键，用户升级后尺寸凭空回默认。
 */
export type ComponentSize = 'large' | 'medium' | 'middle' | 'small';

export type ThemeMode = 'auto' | 'dark' | 'light';

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

/**
 * 通知通道的出场位置（轻提示恒在屏幕居中，见 `@antdv/popup-ui` 的双 toaster 分工）。
 * 值形态沿用 antd 的驼峰命名，映射到 sonner 的连字符写法由应用侧完成。
 */
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

export interface AppSetting {
  /* ---------- 主题 ---------- */
  theme: ThemeMode;
  themeStyle: ThemeStyle;
  primaryColor: string;
  /** 圆角倍率：0 / 0.25 / 0.5 / 0.75 / 1，1 档 = 16px（`--radius-lg` 的基准） */
  borderRadius: number;
  /** 正文字号（px），写侧按它折算根字号百分比 */
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
  /** 顶栏语言切换下拉 */
  widgetLocaleSwitcher: boolean;

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
  notificationPosition: NotificationPosition;
  transitionEffect: TransitionEffect;
  /** 页面切换进度条 */
  showProgressBar: boolean;
  locale: string;
  /** 页面切换 Loading */
  showLoading: boolean;
  routeMode: RouteMode;
}
