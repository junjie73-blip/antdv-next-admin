/** 格式化 TTL */
export function formatTtl(ttl: number): string {
  if (ttl === -2) return '已过期'
  if (ttl === -1) return '永久'
  if (ttl < -2 || !Number.isFinite(ttl)) return '未知'

  if (ttl < 60) return `${ttl}s`
  if (ttl < 3600) return `${Math.floor(ttl / 60)}m`
  if (ttl < 86400) return `${Math.floor(ttl / 3600)}h`
  return `${Math.floor(ttl / 86400)}d`
}

/** 值 → 展示文本 */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '(空)'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
