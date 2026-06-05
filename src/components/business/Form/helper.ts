import type { FormSchema, Recordable, Rule } from './types'
import dayjs from 'dayjs'
import { defu } from 'defu'
import { isFunction } from 'es-toolkit'

/** 需要自动添加 allowClear 的组件类型 */
const CLEARABLE_COMPONENTS = ['Input', 'InputPassword', 'InputSearch', 'Select', 'TreeSelect', 'Cascader', 'AutoComplete', 'DatePicker', 'TimePicker', 'MonthPicker', 'RangePicker', 'WeekPicker', 'TimeRangePicker'] as const

/** 需要自动生成 placeholder 的组件类型 */
const PLACEHOLDER_COMPONENTS = ['Input', 'InputPassword', 'InputSearch', 'InputTextArea', 'InputNumber', 'Select', 'TreeSelect', 'Cascader', 'AutoComplete', 'DatePicker', 'TimePicker', 'MonthPicker', 'RangePicker', 'WeekPicker', 'TimeRangePicker'] as const

/** 组件默认 placeholder 模板 */
const PLACEHOLDER_TEMPLATES: Record<string, (label: string) => string> = {
  Input: label => `请输入${label}`,
  InputPassword: label => `请输入${label}`,
  InputSearch: label => `搜索${label}`,
  InputTextArea: label => `请输入${label}`,
  InputNumber: label => `请输入${label}`,
  Select: label => `请选择${label}`,
  TreeSelect: label => `请选择${label}`,
  Cascader: label => `请选择${label}`,
  AutoComplete: label => `请输入${label}`,
  DatePicker: label => `请选择${label}`,
  TimePicker: label => `请选择${label}`,
  MonthPicker: label => `请选择${label}`,
  RangePicker: label => `请选择${label}范围`,
  WeekPicker: label => `请选择${label}`,
  TimeRangePicker: label => `请选择${label}范围`,
}

export function setComponentProps(schema: FormSchema, formModel: Recordable, formActionType: any) {
  const { component, componentProps = {}, label } = schema

  // 如果 componentProps 是函数，保持原逻辑
  if (isFunction(componentProps)) {
    return componentProps({
      schema,
      values: formModel,
      model: formModel,
      field: schema.field,
    })
  }

  const result: Record<string, any> = { ...componentProps }

  // 自动生成 placeholder（仅在未手动设置时）
  if (component && PLACEHOLDER_COMPONENTS.includes(component as any) && !result.placeholder && label) {
    const template = PLACEHOLDER_TEMPLATES[component]
    if (template) {
      result.placeholder = template(label)
    }
  }

  // 自动添加 allowClear（仅在支持且未手动设置时）
  if (component && CLEARABLE_COMPONENTS.includes(component as any) && result.allowClear === undefined) {
    result.allowClear = true
  }

  return result
}

export function getShow(schema: FormSchema, formModel: Recordable, formActionType: any) {
  const { show, ifShow } = schema

  const showResult = isFunction(show)
    ? show({ schema, values: formModel, model: formModel, field: schema.field })
    : show ?? true

  const ifShowResult = isFunction(ifShow)
    ? ifShow({ schema, values: formModel, model: formModel, field: schema.field })
    : ifShow ?? true

  return {
    show: showResult,
    ifShow: ifShowResult,
  }
}

export function getDynamicDisabled(schema: FormSchema, formModel: Recordable, formActionType: any): boolean {
  const { dynamicDisabled } = schema

  if (isFunction(dynamicDisabled)) {
    return dynamicDisabled({
      schema,
      values: formModel,
      model: formModel,
      field: schema.field,
    })
  }

  return !!dynamicDisabled
}

export function getDynamicRules(schema: FormSchema, formModel: Recordable, formActionType: any): Rule[] | undefined {
  const { rules, required, dynamicRules, rulesMessageJoinLabel } = schema

  if (isFunction(dynamicRules)) {
    return dynamicRules({
      schema,
      values: formModel,
      model: formModel,
      field: schema.field,
    })
  }

  if (required && !rules) {
    const label = schema.label || schema.field
    return [
      {
        required: true,
        message: rulesMessageJoinLabel ? `${label}不能为空` : '该项为必填项',
      },
    ]
  }

  // 防御性检查：过滤掉 pattern 为 null/undefined 的规则，避免 async-validator 报错
  if (rules && Array.isArray(rules)) {
    return rules.filter((rule) => {
      if (rule.pattern != null && !(rule.pattern instanceof RegExp)) {
        console.warn(`[Form] 字段 "${schema.field}" 的规则包含无效 pattern，已跳过`)
        return false
      }
      return true
    })
  }

  return rules
}

export function handleRangeValue(
  values: Recordable,
  fieldMapToTime: [string, [string, string], string?][],
): Recordable {
  const result = { ...values }

  fieldMapToTime.forEach(([field, [startField, endField], format]) => {
    const rangeValue = values[field]
    if (Array.isArray(rangeValue) && rangeValue.length === 2) {
      const [start, end] = rangeValue
      if (format === 'timestamp') {
        result[startField] = new Date(start).getTime() / 1000
        result[endField] = new Date(end).getTime() / 1000
      }
      else if (format === 'timestampStartDay') {
        const startDate = new Date(start)
        startDate.setHours(0, 0, 0, 0)
        const endDate = new Date(end)
        endDate.setHours(0, 0, 0, 0)
        result[startField] = startDate.getTime() / 1000
        result[endField] = endDate.getTime() / 1000
      }
      else {
        const fmt = format || 'YYYY-MM-DD'
        const startDate = new Date(start)
        const endDate = new Date(end)
        result[startField] = formatDate(startDate, fmt)
        result[endField] = formatDate(endDate, fmt)
      }
      delete result[field]
    }
  })

  return result
}

function formatDate(date: Date, format: string): string {
  return dayjs(date).format(format)
}

// 日期相关组件类型
const DATE_COMPONENTS = ['DatePicker', 'MonthPicker', 'RangePicker', 'WeekPicker', 'TimePicker', 'TimeRangePicker'] as const

// 判断值是否为 dayjs 对象或 Date 对象
interface DayjsLike { format: (format: string) => string, isValid?: () => boolean }
function isDayjsOrDate(value: unknown): value is DayjsLike | Date {
  if (value === null || value === undefined)
    return false
  if (value instanceof Date)
    return true
  if (typeof value === 'object' && 'format' in value && typeof (value as DayjsLike).format === 'function') {
    return true
  }
  return false
}

// 格式化日期字段
export function formatDateFields(values: Recordable, schemas: FormSchema[]): Recordable {
  const result = { ...values }

  schemas.forEach((schema) => {
    const { component, field } = schema
    if (!component || !DATE_COMPONENTS.includes(component as any))
      return

    const value = result[field]
    if (value === undefined || value === null)
      return

    // 获取组件配置的 format 或 valueFormat
    const componentProps = schema.componentProps
    let formatStr = 'YYYY-MM-DD HH:mm:ss'

    if (typeof componentProps === 'object' && componentProps !== null) {
      formatStr = (componentProps as any).valueFormat || (componentProps as any).format || formatStr
    }

    // 处理 RangePicker 的范围值
    if (component === 'RangePicker' || component === 'TimeRangePicker') {
      // RangePicker 的值在 handleRangeValue 中处理
      return
    }

    // 处理单个日期值
    if (isDayjsOrDate(value)) {
      if (value instanceof Date) {
        result[field] = formatDate(value, formatStr)
      }
      else {
        result[field] = value.format(formatStr)
      }
    }
  })

  return result
}

export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  return defu(target, source) as T
}
