import type { BasicColumn, Recordable } from './types';

import dayjs from '@antdv/shared/dayjs';
import {
  cloneDeep,
  debounce,
  isFunction,
  isPlainObject,
  merge,
  throttle,
} from 'es-toolkit';

export { debounce, throttle };

const isArray = Array.isArray;

const ANT_TABLE_COLUMN_KEYS = new Set([
  'align',
  'cellStyle',
  'children',
  'className',
  'colSpan',
  'customCell',
  'customHeaderCell',
  'customRender',
  'dataIndex',
  'defaultFilteredValue',
  'ellipsis',
  'filterDropdown',
  'filterDropdownOpen',
  'filteredValue',
  'filterIcon',
  'filterMode',
  'filters',
  'filterSearch',
  'fixed',
  'headerClassName',
  'headerStyle',
  'key',
  'minWidth',
  'onFilter',
  'resizable',
  'rowSpan',
  'showSorterTooltip',
  'sortDirections',
  'sorter',
  'sortOrder',
  'title',
  'width',
]);

export function deepMerge<T extends object = object>(
  target: T,
  source: Partial<T>,
): T {
  if (!source || typeof source !== 'object') return target;
  return merge(cloneDeep(target), source) as T;
}

export function formatCellValue(
  format: ((text: any, record: Recordable, index: number) => string) | string,
  text: any,
  record: Recordable,
  index: number,
): string {
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

export function convertColumns(columns: BasicColumn[]): any[] {
  return columns
    .filter((col) => col.ifShow !== false)
    .map((col) => {
      const result: any = {};
      for (const key of Object.keys(col)) {
        if (ANT_TABLE_COLUMN_KEYS.has(key)) result[key] = (col as any)[key];
      }
      if (!result.key) result.key = col.key || col.dataIndex;
      if (!result.title) result.title = col.title || '';
      return result;
    });
}
