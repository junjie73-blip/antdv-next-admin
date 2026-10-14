import type { ColumnDef } from '@tanstack/vue-table';

import type { Recordable } from './types';

import {
  columnFilteringFeature,
  columnResizingFeature,
  columnSizingFeature,
  createFilteredRowModel,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
} from '@tanstack/vue-table';

/**
 * 静态特性装配：只装这张表真正用到的能力（排序 / 过滤 / 列宽）。
 * 行模型走 `createSortedRowModel → createFilteredRowModel` 的管线，
 * 分页与树形展开由 `BasicTable` 自己控制（服务端分页与 antd 语义一致）。
 *
 * 定义在组件之外：既避免每次 setup 重建，也能让 `convertColumns` 的列定义绑定到
 * 同一份特性集合 —— v9 的 `ColumnDef` 第一个泛参是 `TableFeatures`，
 * 少了它，`enableSorting` / `sortingFn` / `filterFn` 在类型上根本不存在。
 */
export const features = tableFeatures({
  columnFilteringFeature,
  columnResizingFeature,
  columnSizingFeature,
  filteredRowModel: createFilteredRowModel(),
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});

export type TableUIFeatures = typeof features;

/** TanStack 行模型消费的列定义 */
export type TableUIColumnDef = ColumnDef<TableUIFeatures, Recordable, any>;
