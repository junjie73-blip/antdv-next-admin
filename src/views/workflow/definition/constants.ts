import { cn } from '~/utils'

export const containerClassName = cn('space-y-4')

export const DEFINITION_STATUS_MAP: Record<string, { label: string; color: string }> = {
  '0': { label: '草稿', color: 'default' },
  '1': { label: '已发布', color: 'success' },
  '2': { label: '已停用', color: 'default' },
}
