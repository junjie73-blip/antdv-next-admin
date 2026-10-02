import { cn } from '~/utils'

export const containerClassName = cn('space-y-4')

export const SOURCE_MAP: Record<string, { label: string; color: string }> = {
  approval: { label: '审批', color: 'blue' },
  workflow: { label: '工作流', color: 'purple' },
}

export const PRIORITY_MAP: Record<number, { label: string; color: string }> = {
  0: { label: '普通', color: 'default' },
  1: { label: '重要', color: 'orange' },
  2: { label: '紧急', color: 'red' },
}

export const ACTION_COLOR: Record<string, string> = {
  approve: 'green',
  reject: 'red',
  complete: 'green',
  submit: 'blue',
}
