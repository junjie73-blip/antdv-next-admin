import type { BasicColumn, Recordable } from '../types'
import { describe, expect, it } from 'vitest'
import {
  debounce,
  deepMerge,
  filterVisibleColumns,
  formatCellValue,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  generateRowKey,
  getColumnValue,
  getTotalColumnWidth,
  setColumnValue,
  sortColumns,
  throttle,
  truncateText,
} from '../helper'

describe('table Helper Functions', () => {
  describe('deepMerge', () => {
    it('should merge two objects', () => {
      const target = { a: 1, b: 2 }
      const source = { b: 3, c: 4 }
      const result = deepMerge(target, source)
      expect(result).toEqual({ a: 1, b: 3, c: 4 })
    })

    it('should merge nested objects', () => {
      const target: Recordable = { a: 1, nested: { x: 1 } }
      const source: Recordable = { nested: { y: 2 } }
      const result = deepMerge(target, source)
      expect(result).toEqual({ a: 1, nested: { y: 2 } })
    })

    it('should replace arrays', () => {
      const target = { arr: [1, 2] }
      const source = { arr: [3, 4] }
      const result = deepMerge(target, source)
      expect(result).toEqual({ arr: [3, 4] })
    })
  })

  describe('formatCellValue', () => {
    it('should format with function', () => {
      const format = (text: string) => `Hello ${text}`
      const result = formatCellValue(format, 'World', {}, 0)
      expect(result).toBe('Hello World')
    })

    it('should format with template string', () => {
      const format = '{{name}} - {{age}}'
      const record = { name: '张三', age: 25 }
      const result = formatCellValue(format, '', record, 0)
      expect(result).toBe('张三 - 25')
    })

    it('should return original text if no format', () => {
      const result = formatCellValue(undefined as any, 'test', {}, 0)
      expect(result).toBe('test')
    })
  })

  describe('generateRowKey', () => {
    it('should generate key from string', () => {
      const record = { id: '123', name: 'test' }
      const result = generateRowKey(record, 'id', 0)
      expect(result).toBe('123')
    })

    it('should generate key from function', () => {
      const record = { id: '123', name: 'test' }
      const result = generateRowKey(record, r => `${r.id}-${r.name}`, 0)
      expect(result).toBe('123-test')
    })

    it('should generate key from index when key not found', () => {
      const record = { name: 'test' }
      const result = generateRowKey(record, 'id', 5)
      expect(result).toBe('row-5')
    })
  })

  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = new Date(2024, 0, 15, 10, 30, 45)
      const result = formatDate(date, 'YYYY-MM-DD HH:mm:ss')
      expect(result).toBe('2024-01-15 10:30:45')
    })

    it('should format date with different format', () => {
      const date = new Date(2024, 0, 15)
      const result = formatDate(date, 'YYYY/MM/DD')
      expect(result).toBe('2024/01/15')
    })

    it('should return empty string for null value', () => {
      const result = formatDate(null, 'YYYY-MM-DD')
      expect(result).toBe('')
    })
  })

  describe('formatNumber', () => {
    it('should format number with decimals', () => {
      const result = formatNumber(123.456, { decimals: 2 })
      expect(result).toBe('123.46')
    })

    it('should format number with prefix and suffix', () => {
      const result = formatNumber(100, { prefix: '[', suffix: ']' })
      expect(result).toBe('[100]')
    })

    it('should return empty string for null', () => {
      const result = formatNumber(null)
      expect(result).toBe('')
    })
  })

  describe('formatCurrency', () => {
    it('should format currency correctly', () => {
      const result = formatCurrency(1234.56, '¥', 2)
      expect(result).toBe('¥1234.56')
    })

    it('should format currency with default symbol', () => {
      const result = formatCurrency(100)
      expect(result).toBe('¥100.00')
    })
  })

  describe('formatPercent', () => {
    it('should format percent correctly', () => {
      const result = formatPercent(0.1234, 2)
      expect(result).toBe('12.34%')
    })

    it('should format percent with default decimals', () => {
      const result = formatPercent(0.5)
      expect(result).toBe('50.00%')
    })
  })

  describe('truncateText', () => {
    it('should truncate long text', () => {
      const result = truncateText('Hello World', 5)
      expect(result).toBe('Hello...')
    })

    it('should not truncate short text', () => {
      const result = truncateText('Hi', 10)
      expect(result).toBe('Hi')
    })

    it('should use custom suffix', () => {
      const result = truncateText('Hello World', 5, '***')
      expect(result).toBe('Hello***')
    })
  })

  describe('getColumnValue', () => {
    it('should get simple value', () => {
      const record = { name: '张三' }
      const result = getColumnValue(record, 'name')
      expect(result).toBe('张三')
    })

    it('should get nested value', () => {
      const record = { user: { name: '张三' } }
      const result = getColumnValue(record, 'user.name')
      expect(result).toBe('张三')
    })

    it('should get value with array path', () => {
      const record = { data: { list: [{ name: '张三' }] } }
      const result = getColumnValue(record, ['data', 'list', '0', 'name'])
      expect(result).toBe('张三')
    })

    it('should return undefined for missing path', () => {
      const record = { name: '张三' }
      const result = getColumnValue(record, 'age')
      expect(result).toBeUndefined()
    })
  })

  describe('setColumnValue', () => {
    it('should set simple value', () => {
      const record: any = {}
      setColumnValue(record, 'name', '张三')
      expect(record.name).toBe('张三')
    })

    it('should set nested value', () => {
      const record: any = {}
      setColumnValue(record, 'user.name', '张三')
      expect(record.user.name).toBe('张三')
    })

    it('should set value with array path', () => {
      const record: any = {}
      setColumnValue(record, ['data', 'value'], 123)
      expect(record.data.value).toBe(123)
    })
  })

  describe('filterVisibleColumns', () => {
    it('should filter columns by ifShow function', () => {
      const columns: BasicColumn[] = [
        { title: 'A', dataIndex: 'a', ifShow: () => true },
        { title: 'B', dataIndex: 'b', ifShow: () => false },
        { title: 'C', dataIndex: 'c' },
      ]
      const result = filterVisibleColumns(columns)
      expect(result).toHaveLength(2)
      expect(result[0]!.dataIndex).toBe('a')
      expect(result[1]!.dataIndex).toBe('c')
    })

    it('should filter columns by ifShow boolean', () => {
      const columns: BasicColumn[] = [
        { title: 'A', dataIndex: 'a', ifShow: true },
        { title: 'B', dataIndex: 'b', ifShow: false },
      ]
      const result = filterVisibleColumns(columns)
      expect(result).toHaveLength(1)
      expect(result[0]!.dataIndex).toBe('a')
    })
  })

  describe('sortColumns', () => {
    it('should sort columns by order', () => {
      const columns: BasicColumn[] = [
        { title: 'B', dataIndex: 'b' },
        { title: 'A', dataIndex: 'a' },
        { title: 'C', dataIndex: 'c' },
      ]
      const result = sortColumns(columns, ['a', 'b'])
      expect(result[0]!.dataIndex).toBe('a')
      expect(result[1]!.dataIndex).toBe('b')
      expect(result[2]!.dataIndex).toBe('c')
    })

    it('should handle missing keys', () => {
      const columns: BasicColumn[] = [
        { title: 'A', dataIndex: 'a' },
      ]
      const result = sortColumns(columns, ['a', 'b', 'c'])
      expect(result).toHaveLength(1)
      expect(result[0]!.dataIndex).toBe('a')
    })
  })

  describe('getTotalColumnWidth', () => {
    it('should calculate total width', () => {
      const columns: BasicColumn[] = [
        { title: 'A', width: 100 },
        { title: 'B', width: 150 },
        { title: 'C', width: '200' },
      ]
      const result = getTotalColumnWidth(columns)
      expect(result).toBe(450)
    })

    it('should handle undefined width', () => {
      const columns: BasicColumn[] = [
        { title: 'A', width: 100 },
        { title: 'B' },
      ]
      const result = getTotalColumnWidth(columns)
      expect(result).toBe(100)
    })
  })

  describe('debounce', () => {
    it('should debounce function calls', async () => {
      let count = 0
      const fn = () => count++
      const debouncedFn = debounce(fn, 100)

      debouncedFn()
      debouncedFn()
      debouncedFn()

      expect(count).toBe(0)

      await new Promise(resolve => setTimeout(resolve, 150))
      expect(count).toBe(1)
    })
  })

  describe('throttle', () => {
    it('should throttle function calls', async () => {
      let count = 0
      const fn = () => count++
      const throttledFn = throttle(fn, 100)

      throttledFn()
      throttledFn()
      throttledFn()

      expect(count).toBe(1)

      await new Promise(resolve => setTimeout(resolve, 150))
      throttledFn()
      expect(count).toBe(2)
    })
  })
})
