/**
 * 格式化文件大小
 *
 * @example
 * formatSize('1024')       // '1.00 KB'
 * formatSize(null)         // '—'
 * formatSize('1073741824') // '1.00 GB'
 */
export function formatSize(bytes: string | null | undefined): string {
  if (!bytes) return '—'

  const n = Number(bytes)
  if (!Number.isFinite(n) || n < 0) return '—'

  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(2)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(2)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

/**
 * 格式化耗时（毫秒 → 秒）
 *
 * @example
 * formatDuration(1500)  // '1.5s'
 * formatDuration(null)  // '—'
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—'
  return `${(ms / 1000).toFixed(1)}s`
}
