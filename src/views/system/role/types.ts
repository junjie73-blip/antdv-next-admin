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
  /** '1'-全部数据 '2'-自定义数据 '3'-本部门数据 '4'-本部门及以下数据 '5'-仅本人数据 */
  dataScope: string;
}

/** 权限树节点 */
export interface PermissionTreeNode {
  menuId: string;
  menuName: string;
  children?: PermissionTreeNode[];
}
