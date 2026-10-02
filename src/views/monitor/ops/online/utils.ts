/**
 * 格式化会话剩余时间
 * - 负数：`-`（表示永久）
 * - < 60s：`X 秒`
 * - < 3600s：`X 分钟`
 * - 其他：`X 小时`
 */
export function formatSessionTtl(ttl: number): string {
  if (ttl < 0) return '-'
  if (ttl < 60) return `${ttl} 秒`
  if (ttl < 3600) return `${Math.floor(ttl / 60)} 分钟`
  return `${Math.floor(ttl / 3600)} 小时`
}
