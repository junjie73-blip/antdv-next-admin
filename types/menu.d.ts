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
  icon?: string
  component?: string
  permission?: string[]
  hidden?: boolean
  menuName?: string
  title?: string
  microApp?: MicroAppConfig
  /** 是否为外链，点击后在新窗口打开 */
  isExternal?: boolean
  /** 布局类型，blank 表示不使用默认布局，独立全屏渲染 */
  layout?: 'blank'
  children?: MenuConfig[]
}

export interface BackendMenu {
  menuId: string
  parentId: string | null
  menuName: string
  menuType: number // 1-目录 2-菜单 3-按钮
  icon?: string
  path?: string
  component?: string
  permission?: string
  sortOrder: number
  status: string // '0' 禁用 '1' 启用
  children?: BackendMenu[]
}

export interface MenuState {
  menus: MenuConfig[]
  isLoaded: boolean
}
