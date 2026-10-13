import type { FormSchema, Recordable, Rule } from './types';

import dayjs from 'dayjs';
import { isFunction } from 'es-toolkit';

/** 需要自动添加 allowClear 的组件类型 */
const CLEARABLE_COMPONENTS = [
  'Input',
  'InputPassword',
  'InputSearch',
  'Select',
  'TreeSelect',
  'Cascader',
  'AutoComplete',
  'DatePicker',
  'TimePicker',
  'MonthPicker',
  'RangePicker',
  'WeekPicker',
  'TimeRangePicker',
] as const;

/** 需要自动生成 placeholder 的组件类型 */
const PLACEHOLDER_COMPONENTS = [
  'Input',
  'InputPassword',
  'InputSearch',
  'InputTextArea',
  'InputNumber',
  'Select',
  'TreeSelect',
  'Cascader',
  'AutoComplete',
  'DatePicker',
  'TimePicker',
  'MonthPicker',
  'RangePicker',
  'WeekPicker',
  'TimeRangePicker',
] as const;

/** 组件默认 placeholder 模板 */
const PLACEHOLDER_TEMPLATES: Record<string, (label: string) => string> = {
  AutoComplete: (label) => `请输入${label}`,
  Cascader: (label) => `请选择${label}`,
  DatePicker: (label) => `请选择${label}`,
  Input: (label) => `请输入${label}`,
  InputNumber: (label) => `请输入${label}`,
  InputPassword: (label) => `请输入${label}`,
  InputSearch: (label) => `搜索${label}`,
  InputTextArea: (label) => `请输入${label}`,
  MonthPicker: (label) => `请选择${label}`,
  RangePicker: (label) => `请选择${label}范围`,
  Select: (label) => `请选择${label}`,
  TimePicker: (label) => `请选择${label}`,
  TimeRangePicker: (label) => `请选择${label}范围`,
  TreeSelect: (label) => `请选择${label}`,
  WeekPicker: (label) => `请选择${label}`,
};

export function setComponentProps(
  schema: FormSchema | undefined,
  formModel: Recordable,
  _formActionType: any,
) {
  if (!schema) return {};

  const { component, componentProps = {}, label } = schema;

  if (isFunction(componentProps)) {
    return componentProps({
      field: schema.field,
      model: formModel,
      schema,
      values: formModel,
    });
  }

  const result: Record<string, any> = { ...componentProps };

  if (
    component &&
    PLACEHOLDER_COMPONENTS.includes(component as any) &&
    !result.placeholder &&
    label
  ) {
    const template = PLACEHOLDER_TEMPLATES[component];
    if (template) {
      result.placeholder = template(label);
    }
  }

  if (
    component &&
    CLEARABLE_COMPONENTS.includes(component as any) &&
    result.allowClear === undefined
  ) {
    result.allowClear = true;
  }

  return result;
}

export function getShow(
  schema: FormSchema | undefined,
  formModel: Recordable,
  _formActionType: any,
) {
  if (!schema) return { show: false, ifShow: false };

  const { show, ifShow } = schema;

  const showResult = isFunction(show)
    ? show({ field: schema.field, model: formModel, schema, values: formModel })
    : (show ?? true);

  const ifShowResult = isFunction(ifShow)
    ? ifShow({ field: schema.field, model: formModel, schema, values: formModel })
    : (ifShow ?? true);

  return { show: showResult, ifShow: ifShowResult };
}

export function getDynamicDisabled(
  schema: FormSchema | undefined,
  formModel: Recordable,
  _formActionType: any,
): boolean {
  if (!schema) return false;

  const { dynamicDisabled } = schema;

  if (isFunction(dynamicDisabled)) {
    return dynamicDisabled({
      field: schema.field,
      model: formModel,
      schema,
      values: formModel,
    });
  }

  return !!dynamicDisabled;
}

export function getDynamicRules(
  schema: FormSchema | undefined,
  formModel: Recordable,
  _formActionType: any,
): Rule[] | undefined {
  if (!schema) return undefined;

  const { rules, required, dynamicRules, rulesMessageJoinLabel } = schema;

  if (isFunction(dynamicRules)) {
    return dynamicRules({
      field: schema.field,
      model: formModel,
      schema,
      values: formModel,
    });
  }

  const label = schema.label || schema.field;

  const validRules: Rule[] = Array.isArray(rules)
    ? rules.filter((rule) => {
        if (rule.pattern != null && !(rule.pattern instanceof RegExp)) {
          console.warn(
            `[Form] 字段 "${schema.field}" 的规则包含无效 pattern，已跳过`,
          );
          return false;
        }
        return true;
      })
    : [];

  if (required) {
    const hasRequired = validRules.some((r) => r.required);
    if (!hasRequired) {
      validRules.unshift({
        message: rulesMessageJoinLabel ? `${label}不能为空` : '该项为必填项',
        required: true,
      });
    }
  }

  return validRules.length > 0 ? validRules : undefined;
}

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

function formatDate(date: Date, format: string): string {
  return dayjs(date).format(format);
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

    if (component === 'RangePicker' || component === 'TimeRangePicker') {
      return;
    }

    if (isDayjsOrDate(value)) {
      if (value instanceof Date) {
        result[field] = formatDate(value, formatStr);
      } else {
        result[field] = value.format(formatStr);
      }
    }
  });

  return result;
}

/* ============================================================
 * 深度合并：数组「替换」而非「拼接」（与旧实现一致）
 *  - 目标是数组         → 保留目标
 *  - 目标无该键         → 拷贝源（数组/对象做浅拷贝）
 *  - 都是纯对象         → 递归合并
 *  - 其它               → 目标优先
 * ============================================================ */
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
