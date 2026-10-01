export interface StatusConfig {
  label: string
  color: string
  icon?: string
}

/**
 * 成功/失败 状态映射（最常用）
 */
export const SUCCESS_STATUS_MAP: Record<string, StatusConfig> = {
  '1': { label: '成功', color: 'green', icon: 'carbon:checkmark-outline' },
  '0': { label: '失败', color: 'red', icon: 'carbon:close-outline' },
}

/**
 * 正常/停用 状态映射
 */
export const NORMAL_STATUS_MAP: Record<string, StatusConfig> = {
  '1': { label: '正常', color: 'green', icon: 'carbon:checkmark-outline' },
  '0': { label: '停用', color: 'red', icon: 'carbon:close-outline' },
}

/**
 * 启用/禁用 状态映射
 */
export const ENABLE_STATUS_MAP: Record<string, StatusConfig> = {
  '1': { label: '启用', color: 'green' },
  '0': { label: '禁用', color: 'red' },
}

/**
 * 表单/下拉选项通用工厂
 */
export function statusOptions(map: Record<string, StatusConfig>) {
  return Object.entries(map).map(([value, cfg]) => ({
    label: cfg.label,
    value,
  }))
}

/**
 * 状态文本/颜色读取（带兜底）
 */
export function getStatusLabel(map: Record<string, StatusConfig>, value: string, fallback = '未知'): string {
  return map[value]?.label ?? fallback
}

export function getStatusColor(map: Record<string, StatusConfig>, value: string, fallback = 'default'): string {
  return map[value]?.color ?? fallback
}
