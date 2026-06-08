import dayjs from 'dayjs'
import * as XLSX from 'xlsx'

export interface ExportColumn {
  header: string
  key: string
  width?: number
}

export interface ExportOptions {
  /** 文件名（不含扩展名） */
  filename: string
  /** 列配置 */
  columns: ExportColumn[]
  /** 数据源 */
  data: Record<string, any>[]
  /** Sheet 名称，默认 'Sheet1' */
  sheetName?: string
  /** 是否自动调整列宽 */
  autoWidth?: boolean
}

/**
 * 导出数据为 Excel 文件
 *
 * @example
 * ```ts
 * exportToExcel({
 *   filename: '用户列表',
 *   columns: [
 *     { header: '用户名', key: 'username', width: 15 },
 *     { header: '昵称', key: 'nickname', width: 12 },
 *   ],
 *   data: users,
 * })
 * ```
 */
export function exportToExcel(options: ExportOptions) {
  const {
    filename,
    columns,
    data,
    sheetName = 'Sheet1',
    autoWidth = true,
  } = options

  if (!data || data.length === 0) {
    message.warning('没有可导出的数据')
    return
  }

  // 构建表头行和数据行
  const headers = columns.map(col => col.header)
  const rows = data.map(item =>
    columns.map((col) => {
      const value = item[col.key]
      // 处理特殊值
      if (value === null || value === undefined)
        return ''
      if (typeof value === 'object')
        return JSON.stringify(value)
      return value
    }),
  )

  // 创建工作表
  const wsData = [headers, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // 自动调整列宽
  if (autoWidth) {
    const colWidths = columns.map((col, idx) => ({
      wch: col.width || Math.max(
        headers[idx]?.length || 10,
        ...data.map(item => String(item[col.key] ?? '').length),
      ),
    }))
    ws['!cols'] = colWidths
  }
  else if (columns.some(col => col.width)) {
    // 使用指定的列宽
    ws['!cols'] = columns.map(col => ({ wch: col.width || 12 }))
  }

  // 创建工作簿
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  // 生成文件名（带时间戳）
  const timestamp = dayjs().format('YYYYMMDD_HHmmss')
  const finalFilename = `${filename}_${timestamp}.xlsx`

  // 触发下载
  XLSX.writeFile(wb, finalFilename)
  message.success(`成功导出 ${data.length} 条数据`)
}
