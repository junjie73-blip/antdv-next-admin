/* ============================================================
 * 分片上传默认参数
 * ============================================================ */
export const DEFAULT_CONCURRENCY = 2
export const DEFAULT_MAX_RETRY = 3
export const RETRY_BACKOFF_BASE = 1000
export const SPEED_WINDOW_MS = 2000
export const RESUME_STORAGE_PREFIX = 'chunk-upload:'
export const RESUME_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000

/** 分片大小下限：512KB */
export const CHUNK_SIZE_MIN = 512 * 1024

/** 分片大小上限：10MB */
export const CHUNK_SIZE_MAX = 10 * 1024 * 1024

/** 目标分片数 */
export const CHUNK_TARGET_COUNT = 200

/** 预设分片大小阶梯 */
export const CHUNK_SIZE_PRESETS = [
  512 * 1024,
  1 * 1024 * 1024,
  2 * 1024 * 1024,
  4 * 1024 * 1024,
  8 * 1024 * 1024,
] as const

export const DEFAULT_CHUNK_SIZE = 1 * 1024 * 1024

/* ============================================================
 * 错误分类
 * ============================================================ */
export enum UploadErrorCode {
  NETWORK = 'NETWORK',
  TIMEOUT = 'TIMEOUT',
  ABORTED = 'ABORTED',
  SERVER_5XX = 'SERVER_5XX',
  CLIENT_4XX = 'CLIENT_4XX',
  HASH_MISMATCH = 'HASH_MISMATCH',
  CHUNK_MISSING = 'CHUNK_MISSING',
  STORAGE_ERROR = 'STORAGE_ERROR',
  UNKNOWN = 'UNKNOWN',
}

export interface UploadErrorInfo {
  code: UploadErrorCode
  message: string
  retryable: boolean
  retryDelayMs?: number
}

export function classifyUploadError(err: unknown): UploadErrorInfo {
  const anyErr = err as any
  const msg = String(anyErr?.message ?? anyErr ?? '').toLowerCase()
  const status =
    anyErr?.status ?? anyErr?.statusCode ?? anyErr?.response?.status

  if (anyErr?.name === 'AbortError' || anyErr?.code === 'ERR_CANCELED') {
    return {
      code: UploadErrorCode.ABORTED,
      message: '已取消',
      retryable: false,
    }
  }

  if (msg.includes('timeout') || msg.includes('etimedout')) {
    return {
      code: UploadErrorCode.TIMEOUT,
      message: '上传超时，请检查网络',
      retryable: true,
      retryDelayMs: 3000,
    }
  }

  if (
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('enotfound')
  ) {
    return {
      code: UploadErrorCode.NETWORK,
      message: '网络不稳定，请检查连接后重试',
      retryable: true,
      retryDelayMs: 2000,
    }
  }

  if (typeof status === 'number') {
    if (status >= 500) {
      return {
        code: UploadErrorCode.SERVER_5XX,
        message: '服务端异常，请稍后重试',
        retryable: true,
        retryDelayMs: 5000,
      }
    }
    if (status === 429) {
      return {
        code: UploadErrorCode.CLIENT_4XX,
        message: '请求过于频繁，请稍后重试',
        retryable: true,
        retryDelayMs: 10000,
      }
    }
    if (status >= 400) {
      return {
        code: UploadErrorCode.CLIENT_4XX,
        message: msg || '上传被拒绝，请检查文件',
        retryable: false,
      }
    }
  }

  if (msg.includes('完整性校验失败') || msg.includes('hash')) {
    return {
      code: UploadErrorCode.HASH_MISMATCH,
      message: '文件完整性校验失败，请重新上传',
      retryable: false,
    }
  }

  if (msg.includes('分片不完整') || msg.includes('缺失')) {
    return {
      code: UploadErrorCode.CHUNK_MISSING,
      message: '部分分片丢失，请重试',
      retryable: true,
      retryDelayMs: 1000,
    }
  }

  if (msg.includes('storage') || msg.includes('s3') || msg.includes('oss')) {
    return {
      code: UploadErrorCode.STORAGE_ERROR,
      message: '存储服务异常，请稍后重试',
      retryable: true,
      retryDelayMs: 5000,
    }
  }

  return {
    code: UploadErrorCode.UNKNOWN,
    message: String(anyErr?.message ?? '上传失败'),
    retryable: true,
    retryDelayMs: 3000,
  }
}

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
