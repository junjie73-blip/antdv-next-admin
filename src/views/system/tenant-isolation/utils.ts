import { RUN_STATUS_COLOR_MAP } from './constants'

/** 运行状态 → antd Tag 颜色 */
export function getRunStatusColor(status: string): string {
  return RUN_STATUS_COLOR_MAP[status] ?? 'default'
}

/** 毫秒 → "x.xxs"，空值 → "—" */
export function formatDuration(ms: number | null | undefined): string {
  return ms ? `${(ms / 1000).toFixed(2)}s` : '—'
}
