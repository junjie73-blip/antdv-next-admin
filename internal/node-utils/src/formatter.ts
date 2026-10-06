import { BYTE_UNITS, MAX_LABEL_WIDTH } from './constants'

/** 字节数 -> 人类可读；Node 侧统计产物体积用 */
export function formatBytes(bytes: number, fractionDigits = 2): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    BYTE_UNITS.length - 1,
  )
  const value = bytes / 1024 ** exponent
  const unit = BYTE_UNITS[exponent] ?? 'B'
  return `${value.toFixed(exponent === 0 ? 0 : fractionDigits)} ${unit}`
}

/** 毫秒 -> `1.2s` / `350ms` / `2m 5s`，构建耗时日志用 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0ms'
  if (ms < 1000) return `${Math.round(ms)}ms`

  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`

  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return value.toLocaleString('en-US')
}

export function formatPercent(value: number, fractionDigits = 1): string {
  if (!Number.isFinite(value)) return '0%'
  return `${(value * 100).toFixed(fractionDigits)}%`
}

/** 千分位 + 单位，用于文件大小 / 数量混合展示 */
export function formatCount(value: number, unit = ''): string {
  return `${formatNumber(value)}${unit ? ` ${unit}` : ''}`
}

function splitWords(input: string): string[] {
  return input
    // 先在 camel / Pascal 边界插分隔符，再统一按非字母数字切
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
}

export function toCamelCase(input: string): string {
  return splitWords(input)
    .map((word, index) =>
      index === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join('')
}

export function toPascalCase(input: string): string {
  return splitWords(input)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

export function toKebabCase(input: string): string {
  return splitWords(input)
    .map((word) => word.toLowerCase())
    .join('-')
}

export function toSnakeCase(input: string): string {
  return splitWords(input)
    .map((word) => word.toLowerCase())
    .join('_')
}

/** 超长路径 / 标题在终端里会换行，中间截断比尾部截断更能保留文件名 */
export function truncate(input: string, width = MAX_LABEL_WIDTH): string {
  if (input.length <= width) return input
  if (width <= 1) return '…'
  const keep = Math.floor((width - 1) / 2)
  return `${input.slice(0, keep)}…${input.slice(-keep)}`
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural
}

/** 对齐到固定宽度，输出表格化的清单 */
export function padEnd(input: string, width: number): string {
  return input.length >= width ? input : `${input}${' '.repeat(width - input.length)}`
}
