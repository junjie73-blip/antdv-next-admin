import { cn } from '~/utils'

export const containerClassName = cn('space-y-4')
export const cardClassName = cn(
  'shadow-sm rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900',
)

export const BIZ_TYPE_MAP: Record<string, { label: string; color: string; icon: string }> = {
  notice: { label: '通知', color: 'blue', icon: 'lucide:bell' },
  todo: { label: '待办', color: 'orange', icon: 'lucide:list-todo' },
  workflow: { label: '工作流', color: 'purple', icon: 'lucide:git-branch' },
  system: { label: '系统', color: 'default', icon: 'lucide:settings' },
  announcement: { label: '公告', color: 'green', icon: 'lucide:megaphone' },
}

export const PRIORITY_MAP: Record<number, { label: string; color: string }> = {
  0: { label: '普通', color: 'default' },
  1: { label: '重要', color: 'orange' },
  2: { label: '紧急', color: 'red' },
}

export const BIZ_TABS = [
  { key: 'all', label: '全部' },
  { key: 'notice', label: '通知' },
  { key: 'todo', label: '待办' },
  { key: 'workflow', label: '工作流' },
  { key: 'system', label: '系统' },
  { key: 'announcement', label: '公告' },
] as const
