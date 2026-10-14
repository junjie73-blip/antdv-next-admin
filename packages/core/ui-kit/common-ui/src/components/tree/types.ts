export interface TreeFieldNames {
  children?: string;
  key?: string;
  title?: string;
}

export type TreeKey = number | string;

export interface NormalTreeNode {
  children: NormalTreeNode[];
  data: Record<string, any>;
  disabled: boolean;
  hasChildren: boolean;
  key: TreeKey;
  title: string;
}

export interface TreeContext {
  blockNode: boolean;
  checkable: boolean;
  checkedKeys: Set<string>;
  expandedKeys: Set<string>;
  halfCheckedKeys: Set<string>;
  onCheck: (node: NormalTreeNode, checked: boolean) => void;
  onExpand: (node: NormalTreeNode) => void;
  onSelect: (node: NormalTreeNode) => void;
  selectable: boolean;
  selectedKeys: Set<string>;
}

/** reka 与 antd 都可能给出数字或字符串键，比较时统一成字符串 */
export function treeKey(key: TreeKey) {
  return String(key);
}
