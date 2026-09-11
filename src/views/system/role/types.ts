/** 角色记录 */
export interface RoleRecord {
  roleId: string;
  roleName: string;
  roleCode: string;
  description: string;
  sortOrder: number;
  /** '0'-停用 '1'-正常 */
  status: string;
  /** 已选菜单 ID 列表（权限分配用） */
  menuIds: string[];
  createdAt: string;
}

/** 权限树节点 */
export interface PermissionTreeNode {
  menuId: string;
  menuName: string;
  children?: PermissionTreeNode[];
}
