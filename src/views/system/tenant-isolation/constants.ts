import { cn } from '~/utils/cn'

import type { RuleSeverity } from './types'

// ========== 样式类名 ==========
export const containerClassName = cn('isolation-dashboard', 'space-y-4', 'bg-slate-50', 'min-h-screen')
export const cardClassName = cn('bg-white', 'rounded-lg', 'p-4', 'shadow-sm')
export const kpiCardClassName = cn('kpi-card', 'bg-white', 'rounded-lg', 'p-4', 'shadow-sm')

// ========== 自动刷新 ==========
export const REFRESH_INTERVAL_MS = 30_000
export const TREND_DAYS = 30

// ========== 运行状态映射 ==========
export const RUN_STATUS_COLOR_MAP: Record<string, string> = {
  completed: 'green',
  failed: 'red',
  running: 'blue',
  pending: 'default',
}

// ========== 严重程度颜色 ==========
export const SEVERITY_COLOR_MAP: Record<RuleSeverity, string> = {
  critical: '#dc2626',
  warning: '#f59e0b',
  info: '#3b82f6',
}
