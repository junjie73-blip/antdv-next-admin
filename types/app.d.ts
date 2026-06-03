import type { MappingAlgorithm } from 'antdv-next'

export type ThemeMode = 'light' | 'dark'
export type ComponentSize = 'small' | 'middle' | 'large'
export type LayoutMode = 'vertical' | 'horizontal' | 'mixed'
export type NotificationPosition = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'
export type TransitionEffect = 'fade' | 'slide' | 'zoom' | 'fade-slide' | 'slide-right' | 'slide-left' | 'slide-up' | 'slide-down' | 'scale' | 'flip'
export type RouteMode = 'frontend' | 'backend'

export type ThemeStyle =
  | 'default'
  | 'dark'
  | 'compact'
  | 'mui'
  | 'shadcn'
  | 'cartoon'
  | 'illustration'
  | 'bootstrap'
  | 'skeuomorphism'
  | 'glass'
  | 'geek'

export interface ThemePreset {
  name: string
  label: string
  algorithm?: MappingAlgorithm
  token?: Record<string, unknown>
  components?: Record<string, Record<string, unknown>>
}

export interface AppSetting {
  theme: ThemeMode
  themeStyle: ThemeStyle
  componentSize: ComponentSize
  layout: LayoutMode
  darkSidebar: boolean
  darkHeader: boolean
  colorWeak: boolean
  grayMode: boolean
  borderRadius: number
  notificationPosition: NotificationPosition
  sidebarWidth: number
  showBreadcrumb: boolean
  showTabs: boolean
  tabShowIcon: boolean
  showFooter: boolean
  enableWaterRipple: boolean
  transitionEffect: TransitionEffect
  locale: string
  enableWatermark: boolean
  watermarkContent: string
  sidebarCollapsed: boolean
  primaryColor: string
  routeMode: RouteMode
}
