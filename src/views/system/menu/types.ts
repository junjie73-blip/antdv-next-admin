/** 菜单类型：1-目录 2-菜单 3-按钮 */
export type MenuType = 1 | 2 | 3
export type MenuLayout = 'blank' | 'default'
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
/** 菜单记录 */
export interface MenuRecord {
  menuId: string
  menuName: string
  icon: string
  path: string
  component: string
  menuType: MenuType
  parentId: string | null
  /** '0'-停用 '1'-正常 */
  status: string
  permission: string
  sortOrder: number
  microApp?: MicroAppConfig | null
  isExternal?: boolean
  layout?: MenuLayout | null
  hidden?: boolean
  keepAlive?: boolean
  createdAt?: string
  children?: MenuRecord[]
}
