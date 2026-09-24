/** 菜单类型：1-目录 2-菜单 3-按钮 */
export type MenuType = 1 | 2 | 3

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
  createdAt?: string
  children?: MenuRecord[]
}
