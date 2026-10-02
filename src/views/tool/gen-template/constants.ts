import { cn } from '~/utils'

export const containerClassName = cn('space-y-4')
export const cardClassName = cn(
  'shadow-sm rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900',
)

export const CATEGORY_MAP: Record<string, { label: string; color: string }> = {
  backend: { label: '后端', color: 'blue' },
  frontend: { label: '前端', color: 'green' },
  sql: { label: 'SQL', color: 'orange' },
}

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_MAP).map(([value, meta]) => ({
  label: meta.label,
  value,
}))

/** CodeMirror 语言映射 */
export const CATEGORY_LANGUAGE: Record<string, string> = {
  backend: 'typescript',
  frontend: 'vue',
  sql: 'sql',
}
