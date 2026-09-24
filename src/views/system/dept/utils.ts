import type { DeptRecord, DeptTreeNode } from './types'

/**
 * 将后端返回的部门树转为 a-tree 需要的节点结构
 * 只保留 deptId / deptName / children 三个字段
 */
export function convertToTreeNode(dept: DeptRecord): DeptTreeNode {
  const node: DeptTreeNode = {
    deptId: dept.deptId,
    deptName: dept.deptName,
  }
  if (dept.children?.length) {
    node.children = dept.children.map(convertToTreeNode)
  }
  return node
}
