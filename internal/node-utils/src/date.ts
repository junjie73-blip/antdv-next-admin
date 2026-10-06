import dayjs from 'dayjs'
// dayjs 没有 exports map，产物是给 Node 直接消费的 ESM：子路径必须写全扩展名，
// 否则 `node dist/index.mjs` 会报 ERR_MODULE_NOT_FOUND（Vite/vitest 能容忍无扩展名，
// 所以单测通过不代表 Node 运行时可用）。
import relativeTime from 'dayjs/plugin/relativeTime.js'
import 'dayjs/locale/zh-cn.js'

import { DATE_FORMAT, type DateFormatKey } from './constants'

dayjs.extend(relativeTime)

export type DateInput = dayjs.ConfigType

/** 统一入口：所有脚本/构建期代码走这里取 dayjs 实例，便于集中配置 locale 与插件 */
export function $(value?: DateInput): dayjs.Dayjs {
  return dayjs(value)
}

export function format(value: DateInput, key: DateFormatKey = 'dateTime'): string {
  return dayjs(value).format(DATE_FORMAT[key])
}

export function formatDate(value: DateInput): string {
  return format(value, 'date')
}

export function formatDateTime(value: DateInput): string {
  return format(value, 'dateTime')
}

/** 文件名安全的戳：`2026-10-06T16:35` 这类带冒号/横杠的格式在 Windows 上会踩坑 */
export function fileStamp(value: DateInput = new Date()): string {
  return format(value, 'file')
}

export function fromNow(value: DateInput): string {
  return dayjs(value).locale('zh-cn').fromNow()
}

export function isSameDay(a: DateInput, b: DateInput): boolean {
  return dayjs(a).isSame(dayjs(b), 'day')
}

export function isValidDate(value: DateInput): boolean {
  return dayjs(value).isValid()
}

export interface DateRange {
  end: string
  start: string
}

/** 常用区间：脚本里筛日志 / 提交记录时避免每处手写偏移量 */
export function rangeOf(
  unit: 'day' | 'hour' | 'month' | 'week',
  amount: number,
): DateRange {
  const end = dayjs()
  const start = end.subtract(Math.abs(amount), unit)
  return { start: start.format(DATE_FORMAT.date), end: end.format(DATE_FORMAT.date) }
}

export function daysBetween(a: DateInput, b: DateInput): number {
  return dayjs(b).diff(dayjs(a), 'day')
}

export { dayjs }
