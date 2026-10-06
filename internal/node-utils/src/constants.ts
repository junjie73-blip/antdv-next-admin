/**
 * 常量集中处：脚本 / vite 配置 / nitro 配置都从这里取值，
 * 避免同一份「哪些目录算 workspace 包」「日期怎么落文件名」的魔法字符串散落各处。
 */

/** dayjs 格式模板 */
export const DATE_FORMAT = {
  date: 'YYYY-MM-DD',
  dateTime: 'YYYY-MM-DD HH:mm:ss',
  /** 用于文件名 / 产物目录，含秒级时间戳且不含分隔符冲突字符 */
  file: 'YYYYMMDD_HHmmss',
  month: 'YYYY-MM',
  time: 'HH:mm:ss',
  yearMonthDay: 'YYYY年MM月DD日',
} as const

export type DateFormatKey = keyof typeof DATE_FORMAT

/** workspace 包所在目录（与 pnpm-workspace.yaml 的 packages 保持一致） */
export const WORKSPACE_DIRS = ['apps', 'internal', 'packages'] as const

/** 遍历目录时需要跳过的目录名 */
export const IGNORED_DIRS = [
  '.git',
  '.nitro',
  '.output',
  '.turbo',
  'coverage',
  'dist',
  'node_modules',
] as const

/** JSON 落盘缩进，与仓库代码风格（2 空格）一致 */
export const DEFAULT_INDENT = 2

/** 文本文件后缀，用于 walkFiles 默认过滤 */
export const TEXT_EXTENSIONS = [
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.ts',
  '.vue',
  '.yaml',
  '.yml',
] as const

/** 字节单位换算基数（1 KB = 1024 B） */
export const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const

/** 终端单行最大宽度，超过则截断，避免长路径把日志挤成多行 */
export const MAX_LABEL_WIDTH = 72

/** 常见退出码：脚本用同一套语义，方便 CI 区分「没变化」和「失败」 */
export const EXIT_CODE = {
  changed: 0,
  failed: 1,
  noChange: 2,
} as const
