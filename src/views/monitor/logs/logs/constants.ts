import { cn } from '~/utils'

export const containerClassName = cn('space-y-4 h-full')
export const cardClassName = cn(
  'shadow-sm rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900',
)

export const LEVEL_MAP: Record<string, { label: string; color: string }> = {
  trace: { label: 'TRACE', color: 'default' },
  debug: { label: 'DEBUG', color: 'cyan' },
  info: { label: 'INFO', color: 'blue' },
  warn: { label: 'WARN', color: 'orange' },
  error: { label: 'ERROR', color: 'red' },
  fatal: { label: 'FATAL', color: 'magenta' },
}

export const LEVEL_OPTIONS = Object.entries(LEVEL_MAP).map(([value, meta]) => ({
  label: meta.label,
  value,
}))

export function tryParseJson(s: string): { level?: string; msg?: string; [k: string]: unknown } | null {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

export function extractLevel(line: string): string {
  const j = tryParseJson(line)
  if (j?.level) return String(j.level).toLowerCase()
  const m = line.match(/\b(trace|debug|info|warn|error|fatal)\b/i)
  return m ? m[1]!.toLowerCase() : 'info'
}

export function extractMsg(line: string): string {
  const j = tryParseJson(line)
  if (j?.msg) return String(j.msg)
  return line
}
