/** 用户记录（与后端返回字段一致） */
export interface UserRecord {
  userId: string
  username: string
  realName: string
  email: string
  phone: string
  deptId?: string
  deptName?: string
  roleIds?: string[]
  roles?: Array<{ roleId: string; roleName: string }>
  /** '0'-禁用 '1'-正常 */
  status: string
  sortOrder?: number
  gender?: number
  avatar?: string
  createdAt: string
}

/** 部门树节点 */
export interface DeptTreeNode {
  deptId: string
  deptName: string
  children?: DeptTreeNode[]
}

/** 扁平化部门节点 */
export interface FlatDeptNode {
  deptId: string
  deptName: string
}

/** 角色选项 */
export interface RoleOption {
  label: string
  value: string
}
