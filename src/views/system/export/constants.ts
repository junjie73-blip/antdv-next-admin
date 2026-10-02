import { cn } from '~/utils/cn'

import type { ExportStatus } from './types'

// ========== 样式类名 ==========
export const containerClassName = cn('space-y-4')
export const cardClassName = cn('shadow-sm', 'h-full')

// ========== 自动刷新 ==========
export const REFRESH_INTERVAL_MS = 5_000
export const DEFAULT_PAGE_SIZE = 20
export const PAGE_SIZE_OPTIONS = ['10', '20', '50']

// ========== 状态映射 ==========
export const EXPORT_STATUS_COLOR_MAP: Record<ExportStatus, string> = {
  pending: 'default',
  processing: 'blue',
  completed: 'green',
  failed: 'red',
  cancelled: 'orange',
  expired: 'gray',
}

export const EXPORT_STATUS_LABEL_MAP: Record<ExportStatus, string> = {
  pending: '等待中',
  processing: '处理中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
  expired: '已过期',
}

// ========== 搜索表单下拉 ==========
export const EXPORT_STATUS_FILTER_OPTIONS = [
  { label: '处理中', value: 'processing' },
  { label: '已完成', value: 'completed' },
  { label: '失败', value: 'failed' },
]
