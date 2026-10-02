import { cn } from '~/utils'

export const containerClassName = cn('space-y-4')
export const cardClassName = cn(
  'shadow-sm rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900',
)

/** 队列展示名（避免用原始 queue name） */
export const QUEUE_LABEL: Record<string, string> = {
  'report-export': '报表导出',
  'upload-merge': '分片合并',
  'wf-notify': '工作流通知',
  'cache-warm': '缓存预热',
  export: '导出',
  'report-archive': '报表归档',
}

export const STATUS_MAP: Record<string, { label: string; color: string }> = {
  waiting: { label: '等待', color: 'default' },
  active: { label: '执行中', color: 'processing' },
  completed: { label: '已完成', color: 'success' },
  failed: { label: '失败', color: 'error' },
  delayed: { label: '延迟', color: 'warning' },
  paused: { label: '已暂停', color: 'default' },
  stuck: { label: '卡住', color: 'red' },
}

export const JOB_STATUS_OPTIONS = [
  { label: '等待中', value: 'waiting' },
  { label: '执行中', value: 'active' },
  { label: '已完成', value: 'completed' },
  { label: '失败', value: 'failed' },
  { label: '延迟中', value: 'delayed' },
]

/** 队列状态色（用于卡片顶部状态点） */
export function queueHealthColor(q: { counts: QueueCounts; isPaused: boolean }) {
  if (q.isPaused) return 'gray'
  if (q.counts.failed > 50) return 'red'
  if (q.counts.failed > 0) return 'orange'
  if (q.counts.wait > 100) return 'blue'
  return 'green'
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`
  return `${(ms / 60_000).toFixed(2)}m`
}

export function formatProgress(p: number | object): string {
  if (typeof p === 'number') return `${p}%`
  return JSON.stringify(p)
}

type QueueCounts = {
  wait: number
  active: number
  completed: number
  failed: number
  delayed: number
  paused: number
}
