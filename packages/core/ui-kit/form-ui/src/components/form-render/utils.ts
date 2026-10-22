import type { FormSchema, Recordable } from './schema';

import dayjs from 'dayjs';

/**
 * 深度合并：数组「替换」而非「拼接」（与旧实现一致）
 *  - 目标是数组         → 保留目标
 *  - 目标无该键         → 拷贝源（数组/对象做浅拷贝）
 *  - 都是纯对象         → 递归合并
 *  - 其它               → 目标优先
 */
function isPlainObject(v: unknown): v is Record<string, any> {
  if (v === null || typeof v !== 'object') return false;
  if (Array.isArray(v)) return false;
  if (v instanceof Date) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

export function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T> | undefined,
): T {
  if (!source) return { ...target };

  const result: any = Array.isArray(target) ? [...target] : { ...target };

  for (const key of Object.keys(source)) {
    const sourceVal = (source as any)[key];
    const targetVal = result[key];

    if (sourceVal === undefined) continue;

    if (targetVal === undefined) {
      if (Array.isArray(sourceVal)) result[key] = [...sourceVal];
      else if (isPlainObject(sourceVal)) result[key] = { ...sourceVal };
      else result[key] = sourceVal;
      continue;
    }

    if (Array.isArray(targetVal)) continue;

    if (Array.isArray(sourceVal)) {
      result[key] = [...sourceVal];
      continue;
    }

    if (isPlainObject(targetVal) && isPlainObject(sourceVal)) {
      result[key] = deepMerge(targetVal, sourceVal);
      continue;
    }
  }

  return result;
}

function formatDate(date: Date, format: string): string {
  return dayjs(date).format(format);
}

/**
 * `fieldMapToTime`：把一个区间字段拆成两个独立的起止字段。
 * `format` 缺省按 `YYYY-MM-DD` 出串，另外认 `timestamp` 与 `timestampStartDay`（当天零点）。
 */
export function handleRangeValue(
  values: Recordable,
  fieldMapToTime: [string, [string, string], string?][],
): Recordable {
  const result = { ...values };

  fieldMapToTime.forEach(([field, [startField, endField], format]) => {
    const rangeValue = values[field];
    if (Array.isArray(rangeValue) && rangeValue.length === 2) {
      const [start, end] = rangeValue;
      if (format === 'timestamp') {
        result[startField] = new Date(start).getTime() / 1000;
        result[endField] = new Date(end).getTime() / 1000;
      } else if (format === 'timestampStartDay') {
        const startDate = new Date(start);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(end);
        endDate.setHours(0, 0, 0, 0);
        result[startField] = startDate.getTime() / 1000;
        result[endField] = endDate.getTime() / 1000;
      } else {
        const fmt = format || 'YYYY-MM-DD';
        const startDate = new Date(start);
        const endDate = new Date(end);
        result[startField] = formatDate(startDate, fmt);
        result[endField] = formatDate(endDate, fmt);
      }
      delete result[field];
    }
  });
  return result;
}

const DATE_COMPONENTS = [
  'DatePicker',
  'MonthPicker',
  'RangePicker',
  'WeekPicker',
  'TimePicker',
  'TimeRangePicker',
] as const;

interface DayjsLike {
  format: (format: string) => string;
  isValid?: () => boolean;
}
function isDayjsOrDate(value: unknown): value is Date | DayjsLike {
  if (value === null || value === undefined) return false;
  if (value instanceof Date) return true;
  if (
    typeof value === 'object' &&
    'format' in value &&
    typeof (value as DayjsLike).format === 'function'
  ) {
    return true;
  }
  return false;
}

function formatDateValue(value: unknown, formatStr: string): unknown {
  if (!isDayjsOrDate(value)) return value;
  return value instanceof Date
    ? formatDate(value, formatStr)
    : value.format(formatStr);
}

/**
 * 把日期类字段的值统一成字符串（dayjs / Date 都吃，控件返回哪个都行）。
 * 区间字段是 `[起, 止]`，逐位转换后仍保持数组形态：查询串靠 `arrayFormat: repeat`
 * 出两个同名参数，后端才还原得回数组。
 */
export function formatDateFields(
  values: Recordable,
  schemas: FormSchema[],
): Recordable {
  const result = { ...values };

  schemas.forEach((schema) => {
    const { component, field } = schema;
    if (!component || !DATE_COMPONENTS.includes(component as any)) return;

    const value = result[field];
    if (value === undefined || value === null) return;

    const componentProps = schema.componentProps;
    let formatStr = 'YYYY-MM-DD HH:mm:ss';

    if (typeof componentProps === 'object' && componentProps !== null) {
      formatStr =
        (componentProps as any).valueFormat ||
        (componentProps as any).format ||
        formatStr;
    }

    if (Array.isArray(value)) {
      result[field] = value.map((item) => formatDateValue(item, formatStr));
      return;
    }

    result[field] = formatDateValue(value, formatStr);
  });

  return result;
}
