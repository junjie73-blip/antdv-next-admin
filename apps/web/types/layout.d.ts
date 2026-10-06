export type LayoutMode = 'vertical' | 'horizontal' | 'mixed'

export type MenuTheme = 'light' | 'dark'

export interface LayoutHeaderProps {
  height: number
  showLogo: boolean
  showBreadcrumb: boolean
  showThemeSwitch: boolean
  showFullscreen: boolean
  showLocaleSwitch: boolean
  showUserDropdown: boolean
  showNotice: boolean
}

export interface LayoutSidebarProps {
  width: number
  collapsedWidth: number
  theme: MenuTheme
  showLogo: boolean
  showMenu: boolean
  fixed: boolean
}

export interface LayoutFooterProps {
  height: number
  show: boolean
}

export interface LayoutTabsProps {
  show: boolean
  showRefresh: boolean
  showCloseAll: boolean
}

export interface LayoutSettings {
  layout: LayoutMode
  header: LayoutHeaderProps
  sidebar: LayoutSidebarProps
  footer: LayoutFooterProps
  tabs: LayoutTabsProps
  contentFullHeight: boolean
}

export interface MenuRouteItem {
  path: string
  name: string
  meta?: {
    title: string
    icon?: string
    hidden?: boolean
    keepAlive?: boolean
  }
  children?: MenuRouteItem[]
}
