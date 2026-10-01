import { cn } from '~/utils'

import type { ExportTaskStatus, ExportType } from './types'

export const containerClassName = cn('space-y-4')

/** 状态配置 */
export const STATUS_MAP: Record<ExportTaskStatus, { label: string; color: string; badge: string; icon: string }> = {
  pending: {
    label: '排队中',
    color: 'default',
    badge: 'bg-gray-100 text-gray-700 ring-gray-200',
    icon: 'lucide:clock',
  },
  processing: {
    label: '生成中',
    color: 'processing',
    badge: 'bg-blue-50 text-blue-700 ring-blue-200',
    icon: 'lucide:loader-2',
  },
  completed: {
    label: '已完成',
    color: 'success',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    icon: 'lucide:check-circle-2',
  },
  failed: {
    label: '失败',
    color: 'error',
    badge: 'bg-rose-50 text-rose-700 ring-rose-200',
    icon: 'lucide:x-circle',
  },
  cancelled: {
    label: '已取消',
    color: 'default',
    badge: 'bg-gray-100 text-gray-500 ring-gray-200',
    icon: 'lucide:ban',
  },
}

/** 文件类型配置 */
export const EXPORT_TYPE_MAP: Record<ExportType, { label: string; icon: string; color: string }> = {
  excel: {
    label: 'Excel',
    icon: 'lucide:file-spreadsheet',
    color: 'text-emerald-600 bg-emerald-50',
  },
  csv: {
    label: 'CSV',
    icon: 'lucide:file-text',
    color: 'text-blue-600 bg-blue-50',
  },
  pdf: {
    label: 'PDF',
    icon: 'lucide:file-type',
    color: 'text-rose-600 bg-rose-50',
  },
  html: {
    label: 'HTML',
    icon: 'lucide:file-code',
    color: 'text-violet-600 bg-violet-50',
  },
}

/** 状态筛选 Tab */
export const STATUS_TABS: Array<{ label: string; value: string }> = [
  { label: '全部', value: '' },
  { label: '排队中', value: 'pending' },
  { label: '生成中', value: 'processing' },
  { label: '已完成', value: 'completed' },
  { label: '失败', value: 'failed' },
  { label: '已取消', value: 'cancelled' },
]

/** 错误类型映射 */
export const ERROR_TYPE_MAP: Record<string, { label: string; color: string }> = {
  retryable: { label: '可重试', color: 'orange' },
  fatal: { label: '不可重试', color: 'red' },
  unknown: { label: '未知', color: 'default' },
}

/** 格式化文件大小 */
export function formatSize(bytes: number | null): string {
  if (!bytes) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(1)} ${units[i]}`
}

/** 格式化耗时 */
export function formatDuration(ms: number | null): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m${Math.floor((ms % 60_000) / 1000)}s`
}

/** 判断是否可下载 */
export function canDownload(task: { status: string; file_url: string | null; expires_at: string | null }): boolean {
  if (task.status !== 'completed' || !task.file_url) return false
  if (task.expires_at && new Date(task.expires_at) < new Date()) return false
  return true
}
