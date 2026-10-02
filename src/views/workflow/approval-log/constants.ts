import { cn } from '~/utils'

export const containerClassName = cn('space-y-4')

export const ACTION_MAP: Record<string, { label: string; color: string }> = {
  SUBMIT: { label: '提交', color: 'blue' },
  APPROVE: { label: '通过', color: 'green' },
  REJECT: { label: '驳回', color: 'red' },
  RESUBMIT: { label: '重新提交', color: 'purple' },
}
