/** 部门记录 */
export interface DeptRecord {
  /** 主键 */
  deptId: string;
  parentId: string | null;
  deptCode: string;
  deptName: string;
  leader?: string;
  phone?: string;
  email?: string;
  sortOrder: number;
  /** '0'-停用 '1'-正常 */
  status: string;
  createdAt: string;
  children?: DeptRecord[];
  userCount?: number;
}

/** 部门树节点（a-tree 用） */
export interface DeptTreeNode {
  deptId: string;
  deptName: string;
  children?: DeptTreeNode[];
}
