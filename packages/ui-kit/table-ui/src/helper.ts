import type { VNode } from 'vue';

import type { TableUIColumnDef } from './features';
import type { BasicColumn, Recordable } from './types';

import dayjs from '@antdv/shared/dayjs';
import {
  cloneDeep,
  debounce,
  isFunction,
  isPlainObject,
  isString,
  merge,
  throttle,
} from 'es-toolkit';

export { debounce, throttle };

const isArray = Array.isArray;

export function deepMerge<T extends object = object>(
  target: T,
  source: Partial<T>,
): T {
  if (!source || typeof source !== 'object') return target;
  return merge(cloneDeep(target), source) as T;
}

/**
 * `format` 既可以是 `{{text}}/{{index}}/{{其它字段}}` 模板串，也可以是返回字符串或 VNode 的函数
 * （业务里常用函数拼 `<Tag>` 之类的富文本）。
 */
export function formatCellValue(
  format:
    | ((text: any, record: Recordable, index: number) => string | VNode)
    | string,
  text: any,
  record: Recordable,
  index: number,
): string | VNode {
  if (!format) return String(text ?? '');
  if (isFunction(format)) return format(text, record, index);
  return format.replaceAll(/\{\{(\w+)\}\}/g, (_, key) => {
    if (key === 'text') return text ?? '';
    if (key === 'index') return String(index);
    return record[key] ?? '';
  });
}

export function generateRowKey(
  record: Recordable,
  rowKey: ((record: Recordable) => string) | string = 'id',
  index: number,
): string {
  if (isFunction(rowKey)) return rowKey(record);
  const key = record[rowKey];
  return key !== undefined && key !== null ? String(key) : `row-${index}`;
}

export function isImageList(value: unknown): value is string[] {
  if (!isArray(value) || value.length === 0) return false;
  const first = value[0];
  if (typeof first !== 'string') return false;
  const exts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
  const lower = first.toLowerCase();
  return exts.some((ext) => lower.includes(ext));
}

// ⭐ 直接用 dayjs，删除手写补零
export function formatDate(
  value: unknown,
  format = 'YYYY-MM-DD HH:mm:ss',
): string {
  if (!value) return '';
  const d = dayjs(value as Date | number | string);
  return d.isValid() ? d.format(format) : String(value);
}

export function formatNumber(
  value: unknown,
  options?: { decimals?: number; prefix?: string; suffix?: string },
): string {
  if (value === null || value === undefined) return '';
  const num = Number(value);
  if (isNaN(num)) return String(value);
  const { decimals = 0, prefix = '', suffix = '' } = options || {};
  const formatted = decimals > 0 ? num.toFixed(decimals) : String(num);
  return `${prefix}${formatted}${suffix}`;
}

export const formatCurrency = (
  value: unknown,
  currency = '¥',
  decimals = 2,
): string => formatNumber(value, { decimals, prefix: currency });

export const formatPercent = (value: unknown, decimals = 2): string =>
  formatNumber(value, { decimals, suffix: '%' });

export const truncateText = (
  text: string,
  maxLength: number,
  suffix = '...',
): string =>
  !text || text.length <= maxLength ? text : text.slice(0, maxLength) + suffix;

export function getColumnValue(
  record: Recordable,
  dataIndex: string | string[],
): any {
  if (!record) return undefined;
  const keys = isArray(dataIndex)
    ? dataIndex
    : (dataIndex as string).split('.');
  let value: any = record;
  for (const key of keys) {
    if (value == null) return undefined;
    value = value[key];
  }
  return value;
}

/** 与 antd 的取数语义一致：字符串 dataIndex 是单键名，数组才是路径 */
export function readCellText(record: Recordable, col: BasicColumn): any {
  const dataIndex = col.dataIndex;
  if (dataIndex === undefined) return undefined;
  if (isString(dataIndex)) return record?.[dataIndex];
  return getColumnValue(record, dataIndex);
}

export function setColumnValue(
  record: Recordable,
  dataIndex: string | string[],
  value: any,
): void {
  const keys = isArray(dataIndex)
    ? dataIndex
    : (dataIndex as string).split('.');
  let target: any = record;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!;
    if (!isPlainObject(target[key])) target[key] = {};
    target = target[key];
  }
  target[keys[keys.length - 1]!] = value;
}

export const filterVisibleColumns = (columns: BasicColumn[]): BasicColumn[] =>
  columns.filter((col) => {
    if (col.ifShow === false) return false;
    if (isFunction(col.ifShow)) return col.ifShow(col);
    return true;
  });

export function sortColumns(
  columns: BasicColumn[],
  order: string[],
): BasicColumn[] {
  const map = new Map(columns.map((col) => [col.key || col.dataIndex, col]));
  const sorted: BasicColumn[] = [];
  for (const key of order) {
    const col = map.get(key);
    if (col) {
      sorted.push(col);
      map.delete(key);
    }
  }
  sorted.push(...map.values());
  return sorted;
}

export function getTotalColumnWidth(columns: BasicColumn[]): number {
  return columns.reduce((total, col) => {
    const w =
      typeof col.width === 'number'
        ? col.width
        : Number.parseInt(col.width as string) || 0;
    return total + w;
  }, 0);
}

/** 列的稳定 id：key 优先，其次字符串 dataIndex */
export function getColumnId(col: BasicColumn): string {
  if (col.key) return col.key;
  if (isString(col.dataIndex)) return col.dataIndex;
  if (isArray(col.dataIndex)) return col.dataIndex.join('.');
  return '';
}

/**
 * `BasicColumn[]` → TanStack `ColumnDef[]`。
 *
 * 渲染仍由 `BasicTable` 手工完成（保留 header-/cell- 插槽协议），
 * 这里产出的列定义只驱动 TanStack 的行模型管线：
 * - `accessorFn` 复刻 antd 的 dataIndex 取数（字符串是单键，数组是路径）；
 * - `sorter` 为函数/`{compare}` 时本地排序，为 `true` 时只翻转状态不动数据
 *   （antd 的 `sorter: true` 就是"交给服务端"的语义）；
 * - `onFilter` 存在才真正过滤，`filters` 单独出现只是展示用菜单。
 */
export function convertColumns(
  columns: BasicColumn[],
): TableUIColumnDef[] {
  return filterVisibleColumns(columns).map((col) => {
    const id = getColumnId(col);
    const compare = isFunction(col.sorter)
      ? col.sorter
      : isPlainObject(col.sorter)
        ? (col.sorter as { compare: (a: Recordable, b: Recordable) => number })
            .compare
        : undefined;

    const def: TableUIColumnDef = {
      id,
      accessorFn: (row) => readCellText(row, col),
      enableSorting: Boolean(col.sorter),
      enableResizing: Boolean(col.resizable),
      // v9 的字段名是 `sortFn`；`sorter: true` 交给服务端排序，这里只做状态翻转
      sortFn: compare
        ? (rowA, rowB) => compare(rowA.original, rowB.original)
        : () => 0,
      // 只有 `onFilter` 才真正过滤；单独出现 `filters` 只是展示用菜单
      filterFn: col.onFilter
        ? (row, _columnId, filterValue) => {
            if (!isArray(filterValue) || filterValue.length === 0) return true;
            return (filterValue as string[]).some((value) =>
              col.onFilter!(value, row.original),
            );
          }
        : () => true,
      meta: { basicColumn: col },
      header: () => col.title ?? '',
      cell: (info) => info.getValue(),
    };
    return def;
  });
}
