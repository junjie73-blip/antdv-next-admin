import type { ComputedRef } from 'vue';

import type { BasicTableProps, PaginationProps } from '../types';

import { computed } from 'vue';

export interface PaginationInfo {
  current: number;
  pageCount: number;
  pageSize: number;
  pageSizeOptions?: (number | string)[];
  showQuickJumper: boolean;
  showSizeChanger: boolean;
  showTotal?: (total: number, range: [number, number]) => any;
  total: number;
}

export interface UsePaginationModelOptions {
  /** 过滤 + 排序之后的行数（客户端分页的 total 就是它） */
  filteredRowCount: ComputedRef<number>;
  getMergedProps: ComputedRef<BasicTableProps>;
  getPagination: ComputedRef<false | PaginationProps>;
  setPagination: (pagination: Partial<PaginationProps>) => void;
  /** 见 `useTableSorting` 里同名参数：闭包晚绑定，避开初始化顺序 */
  refetch: () => Promise<void>;
}

/**
 * 分页器的视图模型：把内部状态换算成 `TablePagination` 要的显式 props。
 *
 * 页码窗口不在这里算 —— 那部分交给 reka 的 Pagination（首尾恒定可见，中间随当前页滑动），
 * 这里只留 `pageCount` 给"快速跳至"做越界判定。
 */
export function usePaginationModel(options: UsePaginationModelOptions) {
  const {
    filteredRowCount,
    getMergedProps,
    getPagination,
    refetch,
    setPagination,
  } = options;

  const paginationInfo = computed<null | PaginationInfo>(() => {
    const cfg = getPagination.value;
    if (!cfg) return null;
    const rowCount = filteredRowCount.value;
    /** 服务端分页时 total 由接口给；本地数据用过滤后的行数 */
    const total = getMergedProps.value.api ? (cfg.total ?? rowCount) : rowCount;
    const pageSize = cfg.pageSize ?? 10;
    const current = cfg.current ?? 1;
    const pageCount = Math.max(1, Math.ceil((total || 1) / pageSize));
    return {
      current,
      pageCount,
      pageSize,
      pageSizeOptions: cfg.pageSizeOptions,
      // 缺省是"显示"：只有显式传 false 才关掉
      showQuickJumper: cfg.showQuickJumper !== false,
      showSizeChanger: cfg.showSizeChanger !== false,
      showTotal: cfg.showTotal,
      total,
    };
  });

  async function changePage(current: number) {
    const cfg = paginationInfo.value;
    if (!cfg || current === cfg.current) return;
    if (current < 1 || current > cfg.pageCount) return;
    setPagination({ current, pageSize: cfg.pageSize });
    await refetch();
  }

  /** 改每页条数一定回到第 1 页：留在第 8 页换个 pageSize 是 undefined 行为 */
  async function changePageSize(size: number) {
    const cfg = paginationInfo.value;
    if (!cfg || size === cfg.pageSize) return;
    setPagination({ current: 1, pageSize: size });
    await refetch();
  }

  return { changePage, changePageSize, paginationInfo };
}

export type UsePaginationModelReturn = ReturnType<typeof usePaginationModel>;
