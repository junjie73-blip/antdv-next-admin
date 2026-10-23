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

export { resolveCellContent } from './helpers/cellContent';
export type {
  CellContentHandlers,
  CellEditPayload,
} from './helpers/cellContent';
// 单元格渲染与 VNode 落地的辅助件（模板里渲染 `title` / `footer` / `customRender` 用的就是它们）
export { RenderVNode } from './helpers/renderVNode';
// Hooks
export { useColumns } from './hooks/useColumns';
export { useDataSource } from './hooks/useDataSource';
export { useDragSort } from './hooks/useDragSort';
export { useLoading } from './hooks/useLoading';
export { useMergedProps } from './hooks/useMergedProps';
export { usePagination } from './hooks/usePagination';
export { usePaginationModel } from './hooks/usePaginationModel';
export type { PaginationInfo } from './hooks/usePaginationModel';
export { useRowSelection } from './hooks/useRowSelection';
export { useSelectionColumn } from './hooks/useSelectionColumn';
export { useStickyColumns } from './hooks/useStickyColumns';
export { useTableApi } from './hooks/useTableApi';
export { useTableChange } from './hooks/useTableChange';
export { useTableClasses } from './hooks/useTableClasses';

export { useTableFilters } from './hooks/useTableFilters';
export { useTableForm } from './hooks/useTableForm';
export { useTableRows } from './hooks/useTableRows';
export type { DisplayRow } from './hooks/useTableRows';
export { useTableSorting } from './hooks/useTableSorting';
export type { SorterPayload } from './hooks/useTableSorting';
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
