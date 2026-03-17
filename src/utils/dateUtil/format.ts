import type { DateInput } from './types'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const DEFAULT_FORMAT = 'YYYY-MM-DD HH:mm:ss'
const DATE_FORMAT = 'YYYY-MM-DD'
const TIME_FORMAT = 'HH:mm:ss'

export function formatDate(date: DateInput, format = DEFAULT_FORMAT): string {
  return dayjs(date).format(format)
}

export function parseDate(date: DateInput): dayjs.Dayjs {
  return dayjs(date)
}

export function now(): string {
  return formatDate(new Date())
}

export function today(): string {
  return formatDate(new Date(), DATE_FORMAT)
}

export function time(): string {
  return formatDate(new Date(), TIME_FORMAT)
}

export function fromNow(date: DateInput): string {
  return dayjs(date).fromNow()
}

export function toNow(date: DateInput): string {
  return dayjs(date).toNow()
}

export function add(date: DateInput, value: number, unit: dayjs.ManipulateType): dayjs.Dayjs {
  return dayjs(date).add(value, unit)
}

export function subtract(date: DateInput, value: number, unit: dayjs.ManipulateType): dayjs.Dayjs {
  return dayjs(date).subtract(value, unit)
}

export function startOf(date: DateInput, unit: dayjs.OpUnitType): dayjs.Dayjs {
  return dayjs(date).startOf(unit)
}

export function endOf(date: DateInput, unit: dayjs.OpUnitType): dayjs.Dayjs {
  return dayjs(date).endOf(unit)
}

export function diff(date1: DateInput, date2: DateInput, unit: dayjs.QUnitType = 'millisecond'): number {
  return dayjs(date1).diff(dayjs(date2), unit)
}

export function isBefore(date1: DateInput, date2: DateInput): boolean {
  return dayjs(date1).isBefore(dayjs(date2))
}

export function isAfter(date1: DateInput, date2: DateInput): boolean {
  return dayjs(date1).isAfter(dayjs(date2))
}

export function isSame(date1: DateInput, date2: DateInput, unit?: dayjs.OpUnitType): boolean {
  return dayjs(date1).isSame(dayjs(date2), unit)
}

export function isValid(date: DateInput): boolean {
  return dayjs(date).isValid()
}

export function daysInMonth(date: DateInput): number {
  return dayjs(date).daysInMonth()
}

export function getTimestamp(date: DateInput = new Date()): number {
  return dayjs(date).valueOf()
}

export function getUnix(date: DateInput = new Date()): number {
  return dayjs(date).unix()
}
