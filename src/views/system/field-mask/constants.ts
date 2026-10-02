import { cn } from '~/utils'

export const containerClassName = cn('space-y-4')
export const cardClassName = cn(
  'shadow-sm rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900',
)

export const MASK_TYPE_MAP: Record<string, { label: string; color: string }> = {
  phone: { label: '手机号', color: 'blue' },
  email: { label: '邮箱', color: 'cyan' },
  idCard: { label: '身份证', color: 'purple' },
  name: { label: '姓名', color: 'orange' },
  custom: { label: '自定义', color: 'default' },
}

export const MASK_TYPE_OPTIONS = Object.entries(MASK_TYPE_MAP).map(([value, meta]) => ({
  label: meta.label,
  value,
}))

export const STATUS_MAP: Record<string, { label: string; color: string }> = {
  '0': { label: '禁用', color: 'default' },
  '1': { label: '启用', color: 'success' },
}

export const STATUS_OPTIONS = [
  { label: '启用', value: '1' },
  { label: '禁用', value: '0' },
]

/** 各类型的默认参数（用于新增时预填） */
export const MASK_TYPE_DEFAULTS: Record<string, { keepPrefix: number; keepSuffix: number; replaceChar: string }> = {
  phone: { keepPrefix: 3, keepSuffix: 4, replaceChar: '*' },
  email: { keepPrefix: 2, keepSuffix: 0, replaceChar: '*' },
  idCard: { keepPrefix: 6, keepSuffix: 4, replaceChar: '*' },
  name: { keepPrefix: 1, keepSuffix: 0, replaceChar: '*' },
  custom: { keepPrefix: 0, keepSuffix: 0, replaceChar: '*' },
}

/** 前端本地预览：模拟脱敏效果 */
export function previewMask(value: string, keepPrefix: number, keepSuffix: number, replaceChar: string): string {
  if (!value) return ''
  const ch = replaceChar || '*'
  const s = String(value)
  const head = Math.max(0, keepPrefix)
  const tail = Math.max(0, keepSuffix)
  if (s.length <= head + tail) return ch.repeat(s.length)
  return s.slice(0, head) + ch.repeat(s.length - head - tail) + s.slice(-tail)
}
