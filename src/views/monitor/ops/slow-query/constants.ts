import { cn } from '~/utils'

export const containerClassName = cn('space-y-4')
export const cardClassName = cn(
  'shadow-sm rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900',
)

export const STATUS_MAP: Record<string, { label: string; color: string }> = {
  open: { label: '未处理', color: 'red' },
  resolved: { label: '已解决', color: 'green' },
  ignored: { label: '已忽略', color: 'default' },
}

export const STATUS_OPTIONS = [
  { label: '未处理', value: 'open' },
  { label: '已解决', value: 'resolved' },
  { label: '已忽略', value: 'ignored' },
]

export const ORDER_BY_OPTIONS = [
  { label: '平均耗时', value: 'mean' },
  { label: '总耗时', value: 'total' },
  { label: '调用次数', value: 'calls' },
  { label: '最近出现', value: 'last_seen' },
]

export const formatMs = (ms: number): string => {
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(2)} s`
}
