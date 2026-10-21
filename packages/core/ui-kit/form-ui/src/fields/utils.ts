export interface SelectOption {
  disabled?: boolean;
  label?: any;
  value?: any;
  [key: string]: any;
}

export interface TreeOption extends SelectOption {
  children?: TreeOption[];
}

export interface FlattenedTreeOption {
  disabled?: boolean;
  label: any;
  level: number;
  value: any;
}

/** 把任意结构的 options 归一化为 { label, value, disabled } */
export function normalizeOptions(
  options: any[] | undefined,
  fieldNames?: { label?: string; value?: string },
): SelectOption[] {
  const labelKey = fieldNames?.label ?? 'label';
  const valueKey = fieldNames?.value ?? 'value';
  return (options ?? []).map((opt) => {
    if (opt === null || typeof opt !== 'object') {
      return { label: String(opt), value: opt };
    }
    return {
      ...opt,
      disabled: opt.disabled,
      label: opt[labelKey] ?? opt.label ?? String(opt[valueKey] ?? ''),
      value: opt[valueKey] ?? opt.value,
    };
  });
}

/** 深比较（覆盖 number/string/boolean/数组型 value 的选择场景） */
export function optionValueEquals(a: any, b: any): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return (
      a.length === b.length &&
      a.every((item, i) => optionValueEquals(item, b[i]))
    );
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

/** 把树按 fieldNames 拍平成带层级的列表（前序遍历） */
export function flattenTree(
  tree: any[] | undefined,
  fieldNames?: { children?: string; label?: string; value?: string },
  expandedKeys?: any[] | null,
): FlattenedTreeOption[] {
  const childrenKey = fieldNames?.children ?? 'children';
  const labelKey = fieldNames?.label ?? 'label';
  const valueKey = fieldNames?.value ?? 'value';
  const result: FlattenedTreeOption[] = [];

  const walk = (
    nodes: any[] | undefined,
    level: number,
    parentVisible: boolean,
  ) => {
    (nodes ?? []).forEach((node) => {
      if (node === null || node === undefined) return;
      const value = node[valueKey] ?? node.value;
      const children = node[childrenKey] ?? node.children;
      result.push({
        disabled: node.disabled,
        label: node[labelKey] ?? node.label ?? String(value ?? ''),
        level,
        value,
      });
      if (children?.length) {
        // 未提供展开状态时全部展开（treeDefaultExpandAll 语义）
        const childVisible =
          parentVisible && expandedKeys
            ? expandedKeys.some((k) => optionValueEquals(k, value))
            : parentVisible;
        walk(children, level + 1, childVisible);
      }
    });
  };

  walk(tree, 0, true);
  return result;
}

/** 在树中查找某个 value 的 label 路径 */
export function findTreeLabels(
  tree: any[] | undefined,
  value: any,
  fieldNames?: { children?: string; label?: string; value?: string },
): any[] {
  const childrenKey = fieldNames?.children ?? 'children';
  const labelKey = fieldNames?.label ?? 'label';
  const valueKey = fieldNames?.value ?? 'value';
  const labels: any[] = [];

  const walk = (nodes: any[] | undefined, path: any[]): boolean => {
    for (const node of nodes ?? []) {
      if (node === null || node === undefined) continue;
      const nodeValue = node[valueKey] ?? node.value;
      const nodeLabel = node[labelKey] ?? node.label ?? String(nodeValue ?? '');
      const next = [...path, nodeLabel];
      if (optionValueEquals(nodeValue, value)) {
        labels.push(...next);
        return true;
      }
      if (walk(node[childrenKey] ?? node.children, next)) return true;
    }
    return false;
  };

  walk(tree, []);
  return labels;
}
