import type { FormSchema, Recordable, Rule } from './schema';

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
    ? ifShow({
        field: schema.field,
        model: formModel,
        schema,
        values: formModel,
      })
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
