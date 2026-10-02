import type { ExportStatus } from './types'

import { EXPORT_STATUS_COLOR_MAP, EXPORT_STATUS_LABEL_MAP } from './constants'

/** 字节 → 人类可读 */
export function formatFileSize(bytes: string | number | null | undefined): string {
  if (bytes === null || bytes === undefined || bytes === '') return '—'
  const n = Number(bytes)
  if (Number.isNaN(n)) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

/** 毫秒 → "x.xs"，空值 → "—" */
export function formatDuration(ms: number | null | undefined): string {
  return ms ? `${(ms / 1000).toFixed(1)}s` : '—'
}

/** 状态 → Tag 颜色 */
export function getStatusColor(status: ExportStatus | string): string {
  return EXPORT_STATUS_COLOR_MAP[status as ExportStatus] ?? 'default'
}

/** 状态 → 中文文案 */
export function getStatusLabel(status: ExportStatus | string): string {
  return EXPORT_STATUS_LABEL_MAP[status as ExportStatus] ?? status
}
