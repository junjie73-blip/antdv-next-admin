import type { BadgeProps } from 'antdv-next'

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
  name?: string
  path: string // 一定是完整 path，由 store 从路由反查补全
  title: string // 已归一化到 title
  icon?: string
  hidden?: boolean
  isExternal?: boolean
  keepAlive?: boolean
  children?: MenuConfig[]
  meta?: Record<string, unknown>
  disabled?: boolean
  extra?: string | number | boolean
  badge?: BadgeProps
}

export interface BackendMenu {
  menuId: string
  parentId: string | null
  menuName: string
  name?: string
  menuType: number // 1-目录 2-菜单 3-按钮
  icon?: string
  path?: string
  component?: string
  permission?: string
  sortOrder: number
  status: string // '0' 禁用 '1' 启用
  children?: BackendMenu[]
  hidden?: boolean
  isExternal?: boolean
  layout?: 'default' | 'blank'
  keepAlive?: boolean
}

export interface MenuState {
  menus: MenuConfig[]
  isLoaded: boolean
}
