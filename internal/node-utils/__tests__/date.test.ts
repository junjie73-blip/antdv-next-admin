import { describe, expect, it } from 'vitest'

import {
  $,
  daysBetween,
  fileStamp,
  formatDate,
  formatDateTime,
  fromNow,
  isSameDay,
  isValidDate,
  rangeOf,
} from '../src/date'

const SAMPLE = new Date('2026-03-05T08:09:10')

describe('date 格式化', () => {
  it('按语义 key 输出固定格式', () => {
    expect(formatDate(SAMPLE)).toBe('2026-03-05')
    expect(formatDateTime(SAMPLE)).toBe('2026-03-05 08:09:10')
  })

  it('fileStamp 不含冒号/横杠，可安全做文件名', () => {
    const stamp = fileStamp(SAMPLE)
    expect(stamp).toBe('20260305_080910')
    expect(stamp).toMatch(/^[\d_]+$/)
  })
})

describe('date 判断', () => {
  it('isSameDay / isValidDate', () => {
    expect(isSameDay(SAMPLE, '2026-03-05T23:00:00')).toBe(true)
    expect(isSameDay(SAMPLE, '2026-03-06T00:00:00')).toBe(false)
    expect(isValidDate('not-a-date')).toBe(false)
    expect(isValidDate(SAMPLE)).toBe(true)
  })

  it('daysBetween 带符号', () => {
    expect(daysBetween('2026-03-01', '2026-03-05')).toBe(4)
    expect(daysBetween('2026-03-05', '2026-03-01')).toBe(-4)
  })

  it('fromNow 输出中文相对时间', () => {
    expect(fromNow($('2020-01-01'))).toContain('前')
  })
})

describe('rangeOf', () => {
  it('返回 start <= end 的日期区间', () => {
    const { end, start } = rangeOf('day', 7)
    expect(start).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(daysBetween(start, end)).toBe(7)
  })

  it('负数偏移按绝对值处理', () => {
    const positive = rangeOf('week', 2)
    const negative = rangeOf('week', -2)
    expect(positive).toEqual(negative)
  })
})
