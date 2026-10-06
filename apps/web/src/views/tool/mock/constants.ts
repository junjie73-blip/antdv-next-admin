import { cn } from '~/utils/cn'

// ========== 样式类名 ==========
export const containerClassName = cn('space-y-4')
export const cardClassName = cn('shadow-sm')
export const runtimeBarClassName = cn(
  'flex',
  'flex-wrap',
  'items-center',
  'gap-4',
)
export const runtimeItemClassName = cn('flex', 'items-center', 'gap-2')
export const runtimeLabelClassName = cn(
  'text-sm',
  'text-gray-500',
  'dark:text-gray-400',
)
export const filterBarClassName = cn(
  'flex',
  'flex-wrap',
  'items-center',
  'gap-3',
)
export const actionClassName = cn(
  'flex',
  'items-center',
  'justify-center',
  'whitespace-nowrap',
)
export const btnClassName = cn('px-0.5!')
export const dividerClassName = cn('mx-0')
export const codeClassName = cn('font-mono', 'text-xs')
export const previewClassName = cn(
  'max-h-80',
  'overflow-auto',
  'rounded-lg',
  'bg-gray-50',
  'p-4',
  'font-mono',
  'text-xs',
  'leading-relaxed',
  'dark:bg-gray-900',
)

// ========== HTTP 方法配色 ==========
export const METHOD_COLOR_MAP: Record<string, string> = {
  DELETE: 'red',
  GET: 'green',
  HEAD: 'purple',
  OPTIONS: 'cyan',
  PATCH: 'orange',
  POST: 'blue',
  PUT: 'gold',
}

export const METHOD_OPTIONS = ['DELETE', 'GET', 'POST', 'PUT'].map(
  (method) => ({ label: method, value: method }),
)

// ========== 来源 / 状态映射 ==========
export const SOURCE_LABEL_MAP: Record<string, string> = {
  generated: '面板生成',
  source: '源码定义',
}

export const SOURCE_COLOR_MAP: Record<string, string> = {
  generated: 'blue',
  source: 'default',
}

/** 运行时开关可选项，与 mock/store.ts 的取值范围保持一致 */
export const DELAY_MAX = 30_000
export const DELAY_PRESETS = [0, 200, 500, 1000, 3000]
export const FAIL_RATE_PRESETS = [0, 10, 30, 50, 100]
export const STATUS_OPTIONS = [500, 502, 503, 504, 429, 400].map((status) => ({
  label: String(status),
  value: status,
}))

/** 日志轮询间隔（ms），命中日志由 dev server 内存维护，轮询即可 */
export const LOG_POLL_INTERVALS = [
  { label: '关闭', value: 0 },
  { label: '2s', value: 2000 },
  { label: '5s', value: 5000 },
  { label: '10s', value: 10_000 },
]

export const LOG_LIMIT = 200

// ========== 空状态文案 ==========
export const EMPTY_ROUTE_DESCRIPTION =
  'Mock 接口来自 mock/ 目录，保存自定义接口后立即生效'
export const EMPTY_LOG_DESCRIPTION =
  '面板只记录当次 dev server 的命中，发几次请求就有了'

// ========== 帮助说明 ==========
export const PROD_TIP =
  'Mock 只在开发环境挂载：生产构建不含 /mock-center 接口，面板届时会请求失败。'
export const TEMPLATE_TIP =
  '模板语法来自 mockjs（如 "list|10"、"@cname"、"@integer(1,100)"），保存前可先预览。'
