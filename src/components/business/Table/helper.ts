import type { BasicColumn, Recordable } from './types'
import dayjs from 'dayjs'
import { cloneDeep, isFunction, isPlainObject, merge } from 'es-toolkit'

// 使用原生 Array.isArray 替代 es-toolkit 的 isArray
const isArray = Array.isArray

/**
 * 深度合并对象
 * 为什么需要：合并配置对象，处理数组和对象的深度合并
 */
export function deepMerge<T extends object = object>(target: T, source: Partial<T>): T {
  if (!source || typeof source !== 'object') {
    return target
  }

  return merge(cloneDeep(target), source) as T
}

/**
 * 格式化单元格值
 * 支持字符串模板和函数
 */
export function formatCellValue(
  format: string | ((text: any, record: Recordable, index: number) => string),
  text: any,
  record: Recordable,
  index: number,
): string {
  if (!format)
    return String(text ?? '')

  if (isFunction(format)) {
    return format(text, record, index)
  }

  // 字符串模板处理
  // 支持 {{key}} 语法
  return format.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (key === 'text')
      return text ?? ''
    if (key === 'index')
      return String(index)
    return record[key] ?? ''
  })
}

/**
 * 生成行 key
 */
export function generateRowKey(
  record: Recordable,
  rowKey: string | ((record: Recordable) => string) = 'id',
  index: number,
): string {
  if (isFunction(rowKey)) {
    return rowKey(record)
  }
  const key = record[rowKey]
  if (key !== undefined && key !== null) {
    return String(key)
  }
  // 如果没有 key，使用索引
  return `row-${index}`
}

/**
 * 判断是否为图片列表
 */
export function isImageList(value: unknown): value is string[] {
  if (!isArray(value) || value.length === 0)
    return false

  // 检查第一个元素是否为图片 URL
  const firstItem = (value as unknown[])[0]
  if (typeof firstItem !== 'string')
    return false

  // 简单的图片 URL 判断
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg']
  const lowerCase = firstItem.toLowerCase()
  return imageExtensions.some(ext => lowerCase.includes(ext))
}

/**
 * 格式化日期
 */
export function formatDate(
  value: unknown,
  format = 'YYYY-MM-DD HH:mm:ss',
): string {
  if (!value)
    return ''

  try {
    const date = dayjs(value as string | number | Date)
    if (!date.isValid())
      return String(value)
    return date.format(format)
  }
  catch {
    return String(value)
  }
}

/**
 * 格式化数字
 */
export function formatNumber(
  value: unknown,
  options?: { decimals?: number, prefix?: string, suffix?: string },
): string {
  if (value === null || value === undefined)
    return ''

  const num = Number(value)
  if (isNaN(num))
    return String(value)

  const { decimals = 0, prefix = '', suffix = '' } = options || {}

  const formatted = decimals > 0
    ? num.toFixed(decimals)
    : String(num)

  return `${prefix}${formatted}${suffix}`
}

/**
 * 格式化货币
 */
export function formatCurrency(
  value: unknown,
  currency = '¥',
  decimals = 2,
): string {
  return formatNumber(value, { decimals, prefix: currency })
}

/**
 * 格式化百分比
 */
export function formatPercent(value: unknown, decimals = 2): string {
  return formatNumber(value, { decimals, suffix: '%' })
}

/**
 * 截断文本
 */
export function truncateText(text: string, maxLength: number, suffix = '...'): string {
  if (!text || text.length <= maxLength)
    return text
  return text.slice(0, maxLength) + suffix
}

/**
 * 解析列数据索引
 * 支持嵌套路径如 'user.name'
 */
export function getColumnValue(record: Recordable, dataIndex: string | string[]): any {
  if (!record)
    return undefined

  const keys = isArray(dataIndex) ? dataIndex : (dataIndex as string).split('.')
  let value: any = record

  for (const key of keys) {
    if (value === null || value === undefined) {
      return undefined
    }
    value = value[key]
  }

  return value
}

/**
 * 设置列数据值
 * 支持嵌套路径
 */
export function setColumnValue(
  record: Recordable,
  dataIndex: string | string[],
  value: any,
): void {
  const keys = isArray(dataIndex) ? dataIndex : (dataIndex as string).split('.')
  let target: any = record

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!
    if (!isPlainObject(target[key])) {
      target[key] = {}
    }
    target = target[key]
  }

  target[keys[keys.length - 1]!] = value
}

/**
 * 过滤可见列
 */
export function filterVisibleColumns(columns: BasicColumn[]): BasicColumn[] {
  return columns.filter((col) => {
    if (col.ifShow === false)
      return false
    if (isFunction(col.ifShow))
      return col.ifShow(col)
    return true
  })
}

/**
 * 排序列
 */
export function sortColumns(columns: BasicColumn[], order: string[]): BasicColumn[] {
  const columnMap = new Map(columns.map(col => [col.key || col.dataIndex, col]))
  const sorted: BasicColumn[] = []

  for (const key of order) {
    const col = columnMap.get(key)
    if (col) {
      sorted.push(col)
      columnMap.delete(key)
    }
  }

  // 添加剩余的列
  sorted.push(...columnMap.values())

  return sorted
}

/**
 * 获取列宽度总和
 */
export function getTotalColumnWidth(columns: BasicColumn[]): number {
  return columns.reduce((total, col) => {
    const width = typeof col.width === 'number' ? col.width : Number.parseInt(col.width as string) || 0
    return total + width
  }, 0)
}

/**
 * 延迟执行
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    if (timer)
      clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
    }, delay)
  }
}

/**
 * 节流执行
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle = false

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    if (!inThrottle) {
      fn.apply(this, args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

/**
 * 转换列为 antdv-next 支持的格式
 * 为什么需要：BasicColumn 可能包含一些自定义属性，需要转换为 antdv-next 能识别的格式
 */
export function convertColumns(columns: BasicColumn[]): any[] {
  return columns.map((col) => {
    // 过滤掉 ifShow 为 false 的列
    if (col.ifShow === false)
      return null

    // 转换列配置
    const converted: any = {
      ...col,
      // 确保 key 存在
      key: col.key || col.dataIndex,
      // 确保 title 存在
      title: col.title || '',
      // 转换 dataIndex
      dataIndex: col.dataIndex,
      // 转换 width
      width: col.width,
      // 转换 align
      align: col.align,
      // 转换 fixed
      fixed: col.fixed,
      // 转换 ellipsis
      ellipsis: col.ellipsis,
      // 转换 sorter
      sorter: col.sorter,
      // 转换 filters
      filters: col.filters,
      // 保留 format 用于 #bodyCell 插槽
      format: col.format,
      // 保留 edit 相关属性用于 #bodyCell 插槽
      edit: col.edit,
      editRow: col.editRow,
      editComponent: col.editComponent,
      editComponentProps: col.editComponentProps,
      customRender: col.customRender,
    }

    // 移除自定义属性，避免传递给 antdv-next
    // 注意：保留 format、customRender、edit 等属性，因为在 #bodyCell 插槽中需要使用
    delete converted.ifShow
    delete converted.auth
    delete converted.defaultHidden
    // delete converted.edit  // 保留 edit，用于 #bodyCell 插槽
    // delete converted.editRow  // 保留 editRow，用于 #bodyCell 插槽
    // delete converted.editComponent  // 保留 editComponent，用于 #bodyCell 插槽
    // delete converted.editComponentProps  // 保留 editComponentProps，用于 #bodyCell 插槽
    delete converted.editValueMap
    // delete converted.format  // 保留 format，用于 #bodyCell 插槽
    // delete converted.customRender  // 保留 customRender，用于 #bodyCell 插槽
    delete converted.cellStyle
    delete converted.headerStyle

    return converted
  }).filter(Boolean)
}
