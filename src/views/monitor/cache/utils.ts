/**
 * 格式化字节数为可读文本
 * 例：1536 → "1.50 KB"
 */
export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(2)} ${units[i]}`;
}

/**
 * 格式化运行时长（秒）为「X 天 Y 小时」
 */
export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return `${d} 天 ${h} 小时`;
}

/**
 * 格式化 TTL 显示
 * 负数（-1、-2 等）视为永久
 */
export function formatTtl(ttl: number): string {
  return ttl < 0 ? "永久" : `${ttl}s`;
}

/**
 * 命中率显示（容错：字符串 / 数字 / 空值）
 */
export function formatHitRate(hitRate?: string | number): string {
  if (hitRate === undefined || hitRate === null || hitRate === "") return "-";
  return `${hitRate}%`;
}
