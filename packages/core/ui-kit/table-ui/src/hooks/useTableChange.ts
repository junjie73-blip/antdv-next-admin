import type { ComputedRef } from 'vue';

import type { PaginationProps, Recordable } from '../types';
import type { SorterPayload } from './useTableSorting';

import { nextTick } from 'vue';

/** BasicTable 的 `change` 事件签名（分页 / 筛选 / 排序三段） */
export type EmitChange = (
  pagination: false | PaginationProps | undefined,
  filters: Recordable,
  sorter: Recordable | SorterPayload,
) => void;

export interface UseTableChangeOptions {
  buildFiltersPayload: () => Recordable;
  buildSorterPayload: () => SorterPayload;
  emitChange: EmitChange;
  /** `dataSource.fetch`：服务端排序/筛选要重新取数 */
  fetch: () => Promise<void>;
  getPagination: ComputedRef<false | PaginationProps>;
}

/**
 * 排序 / 筛选 / 分页变化之后的统一收尾。
 *
 * 三个入口原先各自抄一遍"等一下 → 取数 → 抛 change"，其中 `await nextTick()` 是必需的：
 * TanStack 的状态写回与行模型重算是异步的，不等就会把**上一次**的排序报出去。
 * 合成一处以后，三个入口只会走同一条路，`change` 的时序也只有一个定义。
 */
export function useTableChange(options: UseTableChangeOptions) {
  const {
    buildFiltersPayload,
    buildSorterPayload,
    emitChange,
    fetch,
    getPagination,
  } = options;

  async function refetchOnChange() {
    await nextTick();
    await fetch();
    // `pagination: false`（明确不分页）对外报 undefined，与 antd 的 change 签名一致
    emitChange(
      getPagination.value || undefined,
      buildFiltersPayload(),
      buildSorterPayload(),
    );
  }

  return { refetchOnChange };
}

export type UseTableChangeReturn = ReturnType<typeof useTableChange>;
