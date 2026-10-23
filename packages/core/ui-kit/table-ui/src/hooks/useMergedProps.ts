import type { ComputedRef } from 'vue';

import type { BasicTableProps, Recordable, TableRowKey } from '../types';

import { computed } from 'vue';

import { isFunction } from 'es-toolkit';

/**
 * `merged*` 这一族派生值的唯一来源。
 *
 * BasicTable 的每个 prop 都可以被 `setProps` 在运行时覆盖（`propsRef` 叠在 `props` 上），
 * 所以模板与所有 hook 读的都不是 `props.x` 而是 `getMergedProps.value.x`。
 * 这些"取哪一个 + 缺省值是多少"的判断散在原组件里二三十处，
 * 每处都要重背一遍缺省值；漏一处就会出现"setProps 改了但那一处没跟着改"。
 * 集中到一个 hook 后，缺省值只在这里写一次。
 */
export function useMergedProps(getMergedProps: ComputedRef<BasicTableProps>) {
  /** 行主键字段名；函数式 rowKey 走 `getRowKeyValue`，这里只给"字段名"这一路 */
  const mergedRowKey = computed(
    () => (getMergedProps.value.rowKey as string) || 'id',
  );
  const mergedIsTree = computed(() => getMergedProps.value.isTree);
  const mergedChildrenField = computed(
    () => getMergedProps.value.childrenColumnName || 'children',
  );
  const mergedScroll = computed(() => getMergedProps.value.scroll);
  /** 数值 `scroll.y` 决定是否开内部滚动容器并钉住表头（与旧实现一致） */
  const mergedScrollY = computed(() => {
    const y = mergedScroll.value?.y;
    return typeof y === 'number' ? y : undefined;
  });
  const mergedShowHeader = computed(
    () => getMergedProps.value.showHeader ?? true,
  );
  const mergedBordered = computed(() => getMergedProps.value.bordered);
  const mergedRowClassName = computed(() => getMergedProps.value.rowClassName);
  const mergedCellClassName = computed(
    () => getMergedProps.value.cellClassName,
  );
  const mergedEmptyText = computed(() => getMergedProps.value.emptyText);
  const mergedActionColumn = computed(() => getMergedProps.value.actionColumn);
  const mergedIndentSize = computed(
    () => getMergedProps.value.indentSize ?? 20,
  );
  const mergedSortDirections = computed(
    () => getMergedProps.value.sortDirections ?? ['ascend', 'descend'],
  );

  /**
   * 取一行的主键值。
   *
   * `rowKey` 允许写成字段名或取值函数，两种都要支持；返回值**不做字符串化**，
   * 因为展开态是按原始值 `includes` 比较的（见 `useTableRows` 里的说明）。
   */
  function getRowKeyValue(record: Recordable): TableRowKey {
    const rowKey = getMergedProps.value.rowKey;
    if (isFunction(rowKey)) return rowKey(record);
    return record?.[(rowKey as string) || 'id'] as TableRowKey;
  }

  return {
    getRowKeyValue,
    mergedActionColumn,
    mergedBordered,
    mergedCellClassName,
    mergedChildrenField,
    mergedEmptyText,
    mergedIndentSize,
    mergedIsTree,
    mergedRowClassName,
    mergedRowKey,
    mergedScroll,
    mergedScrollY,
    mergedShowHeader,
    mergedSortDirections,
  };
}

export type UseMergedPropsReturn = ReturnType<typeof useMergedProps>;
