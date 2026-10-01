import { cn } from '~/utils'

export const STATUS_MAP: Record<string, { label: string; color: string }> = {
  '0': { label: '草稿', color: 'default' },
  '1': { label: '审批中', color: 'processing' },
  '2': { label: '已通过', color: 'success' },
  '3': { label: '已驳回', color: 'error' },
}

/** 驳回原因分类（建议后端走字典，这里兜底） */
export const REJECT_REASON_OPTIONS = [
  { label: '资料不全', value: 'material_incomplete' },
  { label: '不符合规定', value: 'not_compliant' },
  { label: '预算超标', value: 'budget_exceed' },
  { label: '信息有误', value: 'info_error' },
  { label: '其他', value: 'other' },
]

export const containerClassName = cn('p-4', 'space-y-4')
export const REJECT_REASON_LABEL_MAP: Record<string, string> = REJECT_REASON_OPTIONS.reduce(
  (acc, item) => {
    acc[item.value] = item.label
    return acc
  },
  {} as Record<string, string>,
)

/** 获取驳回原因的展示文本 */
export function getRejectReasonLabel(code?: string | null): string {
  if (!code) return ''
  return REJECT_REASON_LABEL_MAP[code] ?? code
}
