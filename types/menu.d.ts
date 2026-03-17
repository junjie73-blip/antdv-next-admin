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
