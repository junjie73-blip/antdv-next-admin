/** 状态颜色映射 */
export const AUDIT_STATUS_COLOR_MAP: Record<string, string> = {
  '1': 'green',
  '0': 'red',
}

/** 状态文案映射 */
export const AUDIT_STATUS_LABEL_MAP: Record<string, string> = {
  '1': '成功',
  '0': '失败',
}

/** HTTP 方法选项 */
export const HTTP_METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'DELETE'].map((m) => ({
  label: m,
  value: m,
}))

/** 状态下拉选项 */
export const AUDIT_STATUS_OPTIONS = [
  { label: '成功', value: '1' },
  { label: '失败', value: '0' },
]

/** 耗时告警阈值（毫秒），超过则高亮显示 */
export const EXECUTE_TIME_WARN_THRESHOLD = 500
