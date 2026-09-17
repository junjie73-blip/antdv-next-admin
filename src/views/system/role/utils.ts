import { ROLE_STATUS_LABEL_MAP } from "./constants";

import type { RoleRecord } from "./types";
interface TreeNode {
  menuId: string;
  children?: TreeNode[];
}
/**
 * 把角色记录映射为导出用的行数据
 * - status 从 '0' / '1' 转为文案
 */
export function mapRoleForExport(record: RoleRecord) {
  return {
    ...record,
    status: ROLE_STATUS_LABEL_MAP[record.status] || record.status,
  };
}
/**
 * 从后端返回的 menuIds 中，过滤出「叶子节点」
 *
 * 用途：a-tree 父子联动模式下，如果 checkedKeys 里包含父节点，
 *      会把该父节点下所有子节点都勾上。所以回显时只能传叶子节点，
 *      让树根据叶子自动推导父节点的「全选 / 半选」状态。
 *
 * @param tree        菜单树（含 children）
 * @param selectedIds 后端返回的完整 menuIds（含父节点）
 */
export function filterLeafKeys(tree: TreeNode[], selectedIds: string[]): string[] {
  const idSet = new Set(selectedIds);
  const leafKeys: string[] = [];

  function walk(nodes: TreeNode[]) {
    for (const node of nodes) {
      const hasChildren = node.children && node.children.length > 0;
      if (hasChildren) {
        walk(node.children!);
      } else if (idSet.has(node.menuId)) {
        // 叶子节点且在 selectedIds 中
        leafKeys.push(node.menuId);
      }
    }
  }

  walk(tree);
  return leafKeys;
}

/**
 * 合并 a-tree 的 checked + halfChecked
 *
 * @param checkedKeys a-tree @check 第一个参数
 * @param info        a-tree @check 第二个参数（含 halfCheckedKeys）
 */
export function mergeCheckedKeys(checkedKeys: any, info: any): string[] {
  const checked: string[] = Array.isArray(checkedKeys) ? checkedKeys : (checkedKeys?.checked ?? []);
  const half: string[] = info?.halfCheckedKeys ?? [];
  return Array.from(new Set([...checked, ...half]));
}
