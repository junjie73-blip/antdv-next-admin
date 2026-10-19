// 主组件
export { default as BasicTable } from './BasicTable.vue';

// 子组件
export { default as TableAction } from './components/TableAction.vue';
export { default as TableEditableCell } from './components/TableEditableCell.vue';
export { default as TableHeaderCell } from './components/TableHeaderCell.vue';
export { default as TableImg } from './components/TableImg.vue';
export { default as TreeTable } from './components/TreeTable.vue';

// 运行时配置（错误提示 / 权限校验的注入点）
export { configureTable, tableRuntime } from './config';
export type { TableUIRuntime } from './config';

// 工具函数
export {
  convertColumns,
  debounce,
  deepMerge,
  filterVisibleColumns,
  formatCellValue,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  generateRowKey,
  getColumnId,
  getColumnValue,
  getTotalColumnWidth,
  isImageList,
  readCellText,
  setColumnValue,
  sortColumns,
  throttle,
  truncateText,
} from './helper';

// Hooks
export { useColumns } from './hooks/useColumns';
export { useDataSource } from './hooks/useDataSource';
export { useDragSort } from './hooks/useDragSort';
export { useLoading } from './hooks/useLoading';
export { usePagination } from './hooks/usePagination';
export { useRowSelection } from './hooks/useRowSelection';
export { useTableForm } from './hooks/useTableForm';
// 类型
export type {
  ActionColumnProps,
  ActionItem,
  ApiFn,
  ArrayElement,
  BasicColumn,
  BasicTableProps,
  ComponentType,
  FetchParams,
  FetchSetting,
  Fn,
  Nullable,
  PaginationProps,
  Recordable,
  TableActionType,
  TableExpandable,
  TableExpandableConfig,
  TableRowEventHandlers,
  TableRowKey,
  TableRowSelection,
  TableScroll,
  TableSize,
  TreeDataNode,
  TreeTableEmits,
  TreeTableFetchParams,
  TreeTableProps,
  UseColumnsOptions,
  UseColumnsReturn,
  UseDataSourceOptions,
  UseDataSourceReturn,
  UseDragSortOptions,
  UseDragSortReturn,
  UsePaginationOptions,
  UsePaginationReturn,
  UseRowSelectionOptions,
  UseRowSelectionReturn,
  UseTableFormOptions,
  UseTableFormReturn,
  UseTableReturn,
  UseTableScrollOptions,
  UseTableScrollReturn,
} from './types';

export { useTable } from './useTable';
