/* ============================================================
 * 分片上传默认参数
 * ============================================================ */
export const DEFAULT_CONCURRENCY = 3
export const DEFAULT_MAX_RETRY = 3
export const RETRY_BACKOFF_BASE = 1000
export const SPEED_WINDOW_MS = 2000
export const RESUME_STORAGE_PREFIX = 'chunk-upload:'
export const RESUME_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000
/** 分片大小下限：1MB */
export const CHUNK_SIZE_MIN = 1 * 1024 * 1024

/** 分片大小上限：20MB */
export const CHUNK_SIZE_MAX = 20 * 1024 * 1024

/** 目标分片数（用来反推理想分片大小） */
export const CHUNK_TARGET_COUNT = 200

/** 预设分片大小阶梯，按需向上取整 */
export const CHUNK_SIZE_PRESETS = [
  1 * 1024 * 1024,
  2 * 1024 * 1024,
  4 * 1024 * 1024,
  5 * 1024 * 1024,
  10 * 1024 * 1024,
  15 * 1024 * 1024,
  20 * 1024 * 1024,
] as const

/** 兼容旧引用（可删） */
export const DEFAULT_CHUNK_SIZE = CHUNK_SIZE_PRESETS[0]
/* ============================================================
 * 状态文案 / 颜色
 * ============================================================ */
export const STATUS_TEXT: Record<string, string> = {
  waiting: '等待中',
  hashing: '计算中',
  uploading: '上传中',
  paused: '已暂停',
  merging: '合并中',
  success: '已完成',
  error: '上传失败',
  canceled: '已取消',
}

export const STATUS_COLOR: Record<string, string> = {
  waiting: 'default',
  hashing: 'processing',
  uploading: 'processing',
  paused: 'warning',
  merging: 'processing',
  success: 'success',
  error: 'error',
  canceled: 'default',
}
