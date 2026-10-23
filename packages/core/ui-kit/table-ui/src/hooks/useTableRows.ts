import type { ComputedRef, Ref, Slots } from 'vue';

import type {
  BasicColumn,
  BasicTableProps,
  PaginationProps,
  Recordable,
  TableRowKey,
} from '../types';

import { computed, ref, unref, watch } from 'vue';

import { getColumnId } from '../helper';

/** 摊平后的一行：`depth` 给树形缩进，`index` 是当前页内的序号 */
export interface DisplayRow {
  depth: number;
  index: number;
  record: Recordable;
  rowKey: TableRowKey;
}

/** 只用到 `original` 这一项，所以按结构声明，不把 TanStack 的 `Row` 类型透出来 */
interface RowLike {
  original: Recordable;
}

export interface UseTableRowsOptions {
  /** 取数后的全量数据源，用于"树形首屏自动展开" */
  dataSource: ComputedRef<Recordable[]> | Ref<Recordable[]>;
  /** 过滤 + 排序之后的行（分页切片与树形摊平都在这之上做） */
  filteredRows: ComputedRef<RowLike[]>;
  getMergedProps: ComputedRef<BasicTableProps>;
  getRowKeyValue: (record: Recordable) => TableRowKey;
  isTree: ComputedRef<boolean | undefined>;
  childrenField: ComputedRef<string>;
  pagination: ComputedRef<false | PaginationProps>;
  slots: Slots;
  /** 可见列；展开图标只挂在首个数据列上 */
  visibleColumns: ComputedRef<BasicColumn[]>;
}

/**
 * 行的可见性：分页切片 → 树形摊平 → 展开态。
 *
 * 这三步原先平铺在 `BasicTable.vue` 的 setup 里（约 130 行），彼此只靠
 * `expandedRowKeysRef` 与 `pageRows` 相连，跟"渲染"没有耦合，所以整块搬出来。
 * 搬动时最要紧的是保住两条踩过的坑，注释一并跟过来：
 * 展开态用**原始** rowKey（不做 `String()`），以及 `flush: 'post'` + `immediate` 的
 * 自动展开时机。
 */
export function useTableRows(options: UseTableRowsOptions) {
  const {
    childrenField,
    dataSource,
    filteredRows,
    getMergedProps,
    getRowKeyValue,
    isTree,
    pagination,
    slots,
    visibleColumns,
  } = options;

  /** 展开态的 key 列表（树形展开与 expandedRowRender 共用），类型跟着数据源走 */
  const expandedRowKeysRef = ref<TableRowKey[]>([]);

  /**
   * 递归收集所有可展开的 key（支持多级子节点）。
   *
   * ⚠️ 这里**不做 `String()` 归一**：展开态的比较是 `expandedRowKeys.includes(rowKey)`，
   * 而 `rowKey` 取的是 `record[idKey]` 本体。业务表的主键几乎都是数字（菜单/部门的 id），
   * 一旦转成字符串，`['1'].includes(1)` 恒为 false —— 表现是"树表首屏全是折叠状态、
   * 手动点一下才展开"。数字表键交数字，字符串表键交字符串，跟着数据源走才对齐。
   *
   * 取值一律走 `getRowKeyValue`（而不是 `record[rowKeyField]`）：`rowKey` 允许是函数，
   * 而 `displayRows` 摊平时比较的就是它的返回值，两边必须用同一把尺子。
   */
  function collectExpandableKeys(list: Recordable[]): TableRowKey[] {
    const keys: TableRowKey[] = [];
    const walk = (arr: Recordable[]) => {
      for (const item of arr) {
        const children = item?.[unref(childrenField)];
        if (Array.isArray(children) && children.length > 0) {
          keys.push(getRowKeyValue(item));
          walk(children);
        }
      }
    };
    walk(list);
    return keys;
  }

  /**
   * 当前页的行：服务端分页（配了 api）原样渲染取数结果，客户端分页本地切片。
   *
   * 服务端模式不能再切 —— 接口只回这一页的数据，再切一次就是"第 2 页只有 5 行"。
   */
  const pageRows = computed(() => {
    const rows = filteredRows.value;
    const cfg = pagination.value;
    if (!cfg) return rows;
    if (getMergedProps.value.api) return rows;
    const pageSize = cfg.pageSize ?? 10;
    const start = ((cfg.current ?? 1) - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  });

  /** 树形展开：把当前页按 children 字段摊平成带缩进的可见行 */
  const displayRows = computed<DisplayRow[]>(() => {
    const result: DisplayRow[] = [];
    let counter = 0;
    const walk = (record: Recordable, depth: number) => {
      const rowKey = getRowKeyValue(record);
      result.push({ depth, index: counter++, record, rowKey });
      const children = record?.[unref(childrenField)];
      if (
        unref(isTree) &&
        Array.isArray(children) &&
        children.length > 0 &&
        expandedRowKeysRef.value.includes(rowKey)
      ) {
        for (const child of children) walk(child, depth + 1);
      }
    };
    for (const row of pageRows.value) walk(row.original, 0);
    return result;
  });

  /** 首个数据列（序号列与操作列都不该挂展开图标） */
  const firstRenderedColumnId = computed(() => {
    const first = visibleColumns.value[0];
    if (!first) return '';
    const candidate = visibleColumns.value.find(
      (col) => col.key !== 'index' && col.key !== 'action',
    );
    return getColumnId(candidate ?? first);
  });

  const hasExpandedRowRender = computed(
    () =>
      Boolean(getMergedProps.value.expandedRowRender) ||
      Boolean(slots.expandedRowRender),
  );

  const canRowExpand = (record: Recordable) => {
    const rowExpandable = getMergedProps.value.rowExpandable;
    return rowExpandable ? rowExpandable(record) : true;
  };

  /** 树形：有子节点的首个数据列才给展开图标 */
  const showTreeToggle = (col: BasicColumn, record: Recordable) =>
    unref(isTree) &&
    getColumnId(col) === firstRenderedColumnId.value &&
    Array.isArray(record?.[unref(childrenField)]) &&
    record[unref(childrenField)].length > 0;

  /** 非树形：配了 expandedRowRender 且该行允许展开 */
  const showRowToggle = (col: BasicColumn, record: Recordable) =>
    !unref(isTree) &&
    hasExpandedRowRender.value &&
    getColumnId(col) === firstRenderedColumnId.value &&
    canRowExpand(record);

  const isRowExpanded = (rowKey: TableRowKey) =>
    expandedRowKeysRef.value.includes(rowKey);

  function toggleRowExpand(record: Recordable) {
    const rowKey = getRowKeyValue(record);
    const willExpand = !isRowExpanded(rowKey);
    expandedRowKeysRef.value = willExpand
      ? [...expandedRowKeysRef.value, rowKey]
      : expandedRowKeysRef.value.filter((key) => key !== rowKey);
    getMergedProps.value.onExpand?.(willExpand, record);
    const onChange =
      getMergedProps.value.expandable?.onExpandedRowsChange ??
      getMergedProps.value.onExpandedRowsChange;
    onChange?.(expandedRowKeysRef.value);
  }

  // ============================================
  // 树形数据就绪后自动展开所有节点
  // ============================================

  /**
   * `flush: 'post'` 避免在渲染前同步触发，减少一次多余渲染。
   *
   * `immediate`：静态 `dataSource` + `isTree` 的表没有取数环节，
   * `useDataSource` 在 setup 阶段就把数据同步写进了 dataSourceRef ——
   * 非 immediate 的 watcher 看不到"注册之前就已经发生的那次变化"，
   * 于是这类表首屏一行子项都不展开。
   */
  watch(
    () => unref(dataSource),
    (data) => {
      if (!unref(isTree)) return;
      if (
        getMergedProps.value.defaultExpandAllRows === false &&
        expandedRowKeysRef.value.length > 0
      ) {
        return;
      }
      if (getMergedProps.value.defaultExpandAllRows === false) {
        expandedRowKeysRef.value = [];
        return;
      }
      if (data.length > 0) {
        expandedRowKeysRef.value = collectExpandableKeys(data);
      }
    },
    { flush: 'post', immediate: true },
  );

  // ============================================
  // 对外 API（expandAll / collapseAll / expandRows / collapseRows）
  // ============================================

  const expandAll = (list: Recordable[]) => {
    expandedRowKeysRef.value = collectExpandableKeys(list);
  };
  const collapseAll = () => {
    expandedRowKeysRef.value = [];
  };
  const expandRows = (keys: string[]) => {
    const currentKeys = new Set<TableRowKey>(expandedRowKeysRef.value);
    keys.forEach((key) => currentKeys.add(key));
    expandedRowKeysRef.value = [...currentKeys];
  };
  const collapseRows = (keys: string[]) => {
    const keySet = new Set<TableRowKey>(keys);
    expandedRowKeysRef.value = expandedRowKeysRef.value.filter(
      (key) => !keySet.has(key),
    );
  };

  return {
    collectExpandableKeys,
    collapseAll,
    collapseRows,
    displayRows,
    expandAll,
    expandRows,
    expandedRowKeysRef,
    firstRenderedColumnId,
    hasExpandedRowRender,
    isRowExpanded,
    pageRows,
    showRowToggle,
    showTreeToggle,
    toggleRowExpand,
  };
}

export type UseTableRowsReturn = ReturnType<typeof useTableRows>;
