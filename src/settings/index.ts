import type { AppSetting, ComponentSize, LayoutMode, NotificationPosition, RouteMode, ThemeMode, ThemeStyle, TransitionEffect } from '#/app'

export type {
  AppSetting,
  ComponentSize,
  LayoutMode,
  NotificationPosition,
  RouteMode,
  ThemeMode,
  ThemeStyle,
  TransitionEffect,
}

export const DEFAULT_SETTING: AppSetting = {
  theme: 'light',
  themeStyle: 'default',
  componentSize: 'middle',
  layout: 'vertical',
  darkSidebar: false,
  darkHeader: false,
  colorWeak: false,
  grayMode: false,
  borderRadius: 6,
  notificationPosition: 'topRight',
  sidebarWidth: 210,
  showBreadcrumb: true,
  showTabs: true,
  showFooter: true,
  enableWaterRipple: true,
  transitionEffect: 'fade-slide',
  locale: 'zh-CN',
  enableWatermark: false,
  watermarkContent: import.meta.env.VITE_APP_TITLE || 'Admin',
  sidebarCollapsed: false,
  primaryColor: '#1677ff',
  routeMode: 'frontend',
}

export * from './theme'
