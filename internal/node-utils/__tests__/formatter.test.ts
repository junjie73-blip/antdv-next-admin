import { describe, expect, it } from 'vitest'

import {
  formatBytes,
  formatCount,
  formatDuration,
  formatNumber,
  formatPercent,
  padEnd,
  pluralize,
  toCamelCase,
  toKebabCase,
  toPascalCase,
  toSnakeCase,
  truncate,
} from '../src/formatter'

describe('formatBytes', () => {
  it('0 与负数都归零，避免出现 -1.0 KB', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(-1024)).toBe('0 B')
    expect(formatBytes(Number.NaN)).toBe('0 B')
  })

  it('按 1024 进位并保留单位', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1024)).toBe('1.00 KB')
    expect(formatBytes(1024 ** 3)).toBe('1.00 GB')
  })
})

describe('formatDuration', () => {
  it('毫秒 / 秒 / 分三档', () => {
    expect(formatDuration(12)).toBe('12ms')
    expect(formatDuration(1234)).toBe('1.2s')
    expect(formatDuration(65_000)).toBe('1m 5s')
    expect(formatDuration(120_000)).toBe('2m')
  })
})

describe('formatNumber / formatPercent / formatCount', () => {
  it('千分位与百分比', () => {
    expect(formatNumber(12_345)).toBe('12,345')
    expect(formatPercent(0.256)).toBe('25.6%')
    expect(formatCount(1_000, 'files')).toBe('1,000 files')
  })
})

describe('case 转换', () => {
  it('从 camel / kebab / 空格混合输入统一归一', () => {
    expect(toCamelCase('node-utils')).toBe('nodeUtils')
    expect(toCamelCase('NodeUtils')).toBe('nodeUtils')
    expect(toPascalCase('node_utils')).toBe('NodeUtils')
    expect(toKebabCase('NodeUtils')).toBe('node-utils')
    expect(toSnakeCase('node-utils')).toBe('node_utils')
  })

  it('连续大写按缩写处理（HTTPServer -> http-server）', () => {
    expect(toKebabCase('HTTPServer')).toBe('http-server')
  })
})

describe('truncate / pluralize / padEnd', () => {
  it('超长时中间截断，保留首尾', () => {
    const input = 'J:/antdv/frontend/apps/web/src/layouts/components/LayoutSidebar.vue'
    const output = truncate(input, 20)
    expect(output.length).toBeLessThanOrEqual(21)
    expect(output).toContain('…')
    expect(output.startsWith('J:/antdv/')).toBe(true)
    expect(output.endsWith('bar.vue')).toBe(true)
  })

  it('未超长原样返回', () => {
    expect(truncate('abc', 10)).toBe('abc')
  })

  it('单复数与补位', () => {
    expect(pluralize(1, 'file')).toBe('file')
    expect(pluralize(2, 'file')).toBe('files')
    expect(padEnd('ab', 4)).toBe('ab  ')
    expect(padEnd('abcd', 2)).toBe('abcd')
  })
})
