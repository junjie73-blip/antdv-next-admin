/** 按钮权限记录 */
export interface PermissionRecord {
  menuId: string
  menuName: string
  permission: string
  sortOrder: number
  /** '0'-停用 '1'-启用 */
  status: string
  menuType?: string
  description?: string
}

/** 常见按钮预设项 */
export interface CommonButton {
  label: string
  permName: string
  permCode: string
  icon: string
  key: string
}
