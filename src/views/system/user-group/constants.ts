import { cn } from '~/utils'

export const containerClassName = cn('space-y-4')
export const cardClassName = cn(
  'shadow-sm rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900',
)

export const GROUP_TYPE_MAP: Record<string, { label: string; color: string }> = {
  custom: { label: '自定义', color: 'blue' },
  department: { label: '部门镜像', color: 'cyan' },
  project: { label: '项目组', color: 'purple' },
}

export const GROUP_TYPE_OPTIONS = [
  { label: '自定义', value: 'custom' },
  { label: '部门镜像', value: 'department' },
  { label: '项目组', value: 'project' },
]

export const STATUS_MAP: Record<string, { label: string; color: string }> = {
  '0': { label: '禁用', color: 'default' },
  '1': { label: '启用', color: 'success' },
}

export const STATUS_OPTIONS = [
  { label: '启用', value: '1' },
  { label: '禁用', value: '0' },
]
