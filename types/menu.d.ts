export interface MicroAppConfig {
  name: string
  url: string
  baseroute: string
  keepAlive?: boolean
  disableMemoryRouter?: boolean
  disablePatchRequest?: boolean
  inline?: boolean
  destroy?: boolean
}

export interface MenuConfig {
  path: string
  name: string
  title: string
  icon?: string
  component?: string
  redirect?: string
  hidden?: boolean
  keepAlive?: boolean
  requiresAuth?: boolean
  roles?: string[]
  permissions?: string[]
  microApp?: MicroAppConfig
  /** 是否为外链，点击后在新窗口打开 */
  isExternal?: boolean
  /** 布局类型，blank 表示不使用默认布局，独立全屏渲染 */
  layout?: 'blank'
  children?: MenuConfig[]
}

export interface BackendMenu {
  id: string | number
  parentId: string | number | null
  path: string
  name: string
  title: string
  icon?: string
  component?: string
  redirect?: string
  hidden?: boolean
  keepAlive?: boolean
  requiresAuth?: boolean
  roles?: string[]
  permissions?: string[]
  sort?: number
  children?: BackendMenu[]
}

export interface MenuState {
  menus: MenuConfig[]
  isLoaded: boolean
}
