import type { ColumnFiltersState } from '@tanstack/vue-table';

import type { Ref } from 'vue';

import type { BasicColumn, Recordable } from '../types';

import { ref } from 'vue';

import { getColumnId } from '../helper';

/** 只用到 `setFilterValue`，按结构声明，不把 TanStack 的 `Column` 类型透出来 */
interface FilterableColumn {
  setFilterValue: (value: unknown) => void;
}

export interface UseTableFiltersOptions {
  /** 筛选状态的本地镜像（同时喂给 TanStack 的 `state`） */
  columnFiltersRef: Ref<ColumnFiltersState>;
  /** TanStack 的 `table.getColumn(id)` */
  getColumn: (id: string) => FilterableColumn | undefined;
  /** 见 `useTableSorting` 里同名参数：闭包晚绑定，避开初始化顺序 */
  refetch: () => Promise<void>;
}

/**
 * 列头筛选面板（漏斗图标 + 浮层里的一组勾选）。
 *
 * 状态分两份是刻意的：`filterDraft` 是浮层里的**草稿**，点"确定"才写回
 * `columnFiltersRef`；否则勾一下就立刻过滤，"重置/确定"两颗按钮没有意义。
 */
export function useTableFilters(options: UseTableFiltersOptions) {
  const { columnFiltersRef, getColumn, refetch } = options;

  /** 每列浮层的开关，key 是 columnId */
  const filterOpenMap = ref<Record<string, boolean>>({});
  /** 每列浮层里的草稿值 */
  const filterDraft = ref<Record<string, string[]>>({});

  const getFilterValue = (columnId: string): string[] => {
    const entry = columnFiltersRef.value.find((item) => item.id === columnId);
    // 只认数组形：非数组（外部塞进来的脏值）按"没筛"处理
    return Array.isArray(entry?.value) ? entry.value : [];
  };

  /** 打开前先把当前生效值抄成草稿，避免上次没点确定的残留值出现在面板里 */
  function openFilter(columnId: string) {
    filterDraft.value[columnId] = [...getFilterValue(columnId)];
    filterOpenMap.value[columnId] = true;
  }

  function confirmFilter(col: BasicColumn) {
    const columnId = getColumnId(col);
    getColumn(columnId)?.setFilterValue(filterDraft.value[columnId] ?? []);
    filterOpenMap.value[columnId] = false;
    void refetch();
  }

  function clearFilter(col: BasicColumn) {
    filterDraft.value[getColumnId(col)] = [];
    confirmFilter(col);
  }

  const isFilterActive = (col: BasicColumn) =>
    getFilterValue(getColumnId(col)).length > 0;

  /** 空数组不算"筛选中"——`change` 事件的 filters 只报真正生效的条件 */
  function buildFiltersPayload(): Recordable {
    const filters: Recordable = {};
    for (const item of columnFiltersRef.value) {
      if (Array.isArray(item.value) && item.value.length > 0) {
        filters[item.id] = item.value;
      }
    }
    return filters;
  }

  return {
    buildFiltersPayload,
    clearFilter,
    confirmFilter,
    filterDraft,
    filterOpenMap,
    getFilterValue,
    isFilterActive,
    openFilter,
  };
}

export type UseTableFiltersReturn = ReturnType<typeof useTableFilters>;
