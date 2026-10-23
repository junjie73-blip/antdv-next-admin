import type { SortingState } from '@tanstack/vue-table';

import type { ComputedRef, Ref } from 'vue';

import type { BasicColumn, BasicTableProps } from '../types';

import { computed, nextTick } from 'vue';

import { getColumnId } from '../helper';

/** `change` 事件里 `sorter` 那一段的形（照 antd 的 sorter 对象） */
export interface SorterPayload {
  column?: BasicColumn;
  columnKey?: string;
  field?: string | string[];
  order?: 'ascend' | 'descend';
}

export interface UseTableSortingOptions {
  /** 列定义快照（`columns.getColumns`），反查 `sorter.column` 用 */
  getColumns: () => BasicColumn[];
  getMergedProps: ComputedRef<BasicTableProps>;
  /**
   * 排序或筛选变化之后的收尾（取数 + 抛 `change`）。
   *
   * 传的是"取一次的函数"而不是函数本身：`useTableChange` 在这些视图 hook **之后**才建，
   * 直接传会拿到 undefined；`() => refetchOnChange()` 这层闭包到点击时才求值，安全。
   */
  refetch: () => Promise<void>;
  /** TanStack 的 `table.setSorting` */
  setSorting: (state: SortingState) => void;
  /** 排序状态的本地镜像（同时喂给 TanStack 的 `state`，见 BasicTable 里的说明） */
  sortingRef: Ref<SortingState>;
}

/**
 * 排序：点击表头在 `none → 方向1 → 方向2 → none` 之间循环。
 *
 * 状态本身归 `sortingRef`（受控），这里只做"下一步是什么"和"对外怎么报"。
 */
export function useTableSorting(options: UseTableSortingOptions) {
  const { getColumns, getMergedProps, refetch, setSorting, sortingRef } =
    options;

  const mergedSortDirections = computed(
    () => getMergedProps.value.sortDirections ?? ['ascend', 'descend'],
  );

  const getSortOrder = (columnId: string): 'asc' | 'desc' | undefined => {
    const entry = sortingRef.value.find((item) => item.id === columnId);
    if (!entry) return undefined;
    return entry.desc ? 'desc' : 'asc';
  };

  /**
   * antd 的排序循环：none → 首个方向 → 次个方向 → none。
   * `sortDirections` 决定可用方向与顺序（默认 ascend → descend）。
   */
  async function handleSort(col: BasicColumn) {
    if (!col.sorter) return;
    const id = getColumnId(col);
    const orders = mergedSortDirections.value;
    const current = sortingRef.value.find((item) => item.id === id);
    // 没在排 = undefined；在排则按 `desc` 标志映射回 antd 的方向名
    let currentOrder: 'ascend' | 'descend' | undefined;
    if (current) currentOrder = current.desc ? 'descend' : 'ascend';
    const index = currentOrder ? orders.indexOf(currentOrder) : -1;
    const nextOrder = index + 1 < orders.length ? orders[index + 1] : undefined;

    setSorting(nextOrder ? [{ desc: nextOrder === 'descend', id }] : []);
    await nextTick();
    await refetch();
  }

  /** 只报第一个排序列：多列排序（`sorter.multiple`）对外仍按单列口径 */
  function buildSorterPayload(): SorterPayload {
    const entry = sortingRef.value[0];
    if (!entry) return {};
    const col = getColumns().find((item) => getColumnId(item) === entry.id);
    return {
      column: col,
      columnKey: entry.id,
      field: col?.dataIndex ?? entry.id,
      order: entry.desc ? 'descend' : 'ascend',
    };
  }

  return { buildSorterPayload, getSortOrder, handleSort };
}

export type UseTableSortingReturn = ReturnType<typeof useTableSorting>;
