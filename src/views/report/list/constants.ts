import { cn } from '~/utils'

export const containerClassName = cn('p-4', 'space-y-4')

export const CATEGORIES = [
  { label: '全部', value: '' },
  { label: '业务分析', value: 'business' },
  { label: '财务报表', value: 'finance' },
  { label: '运营监控', value: 'ops' },
  { label: '系统统计', value: 'system' },
]
