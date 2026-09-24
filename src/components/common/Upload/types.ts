import type { UploadFile, UploadProps as AntUploadProps } from 'antdv-next'

/* ============================================================
 * 基础 Upload
 * ============================================================ */

export interface UploadProps extends Omit<AntUploadProps, 'onChange'> {
  /** 文件列表（v-model:value） */
  value?: UploadFile[]
  /** 是否多选 */
  multiple?: boolean
  /** 最大文件数量 */
  maxCount?: number
  /** 文件大小限制（MB） */
  maxSize?: number
  /** 接受的文件类型 */
  accept?: string
  /** 是否显示上传列表 */
  showUploadList?: boolean
  /** 列表类型 */
  listType?: 'text' | 'picture' | 'picture-card'
  /** 上传按钮文字 */
  uploadText?: string
  /** 上传按钮图标 */
  uploadIcon?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 是否只读 */
  readonly?: boolean
  /** 附加到 FormData 的额外字段 */
  data?: Record<string, unknown>
  /** 后端接收的字段名，默认 "file" */
  name?: string
  /** 上传前钩子 */
  beforeUpload?: (file: UploadFile, fileList: UploadFile[]) => boolean | Promise<boolean>
  /** 文件变化回调 */
  onChange?: (fileList: UploadFile[]) => void
  /** 上传成功回调 */
  onSuccess?: (response: unknown, file: UploadFile) => void
  /** 上传失败回调 */
  onError?: (error: Error, file: UploadFile) => void
  /** 删除文件回调 */
  onRemove?: (file: UploadFile) => boolean | Promise<boolean>
}

export interface UploadInstance {
  getFileList: () => UploadFile[]
  setFileList: (fileList: UploadFile[]) => void
  clear: () => void
  upload: () => void
}

/* ============================================================
 * 大文件分片上传
 * ============================================================ */

export type UploadStatus = 'waiting' | 'hashing' | 'uploading' | 'paused' | 'merging' | 'success' | 'error' | 'canceled'

export interface ChunkUploadTask {
  uid: string
  file: File
  filename: string
  size: number
  mimeType: string

  hash?: string
  uploadId?: string

  /** 合并任务 id（后端返回，仅供 UI 展示/日志） */
  taskId?: string
  /** 合并阶段状态 */
  mergeStatus?: 'pending' | 'merging' | 'uploading' | 'completed' | 'failed'
  /** 合并开始时间（UI 显示已耗时） */
  mergeStartedAt?: number

  status: UploadStatus
  loaded: number
  total: number
  chunkSize: number
  totalChunks: number
  uploadedChunks: Set<number>
  speed: number
  remaining: number
  error?: string
  retryCount: number
  result?: {
    fileId?: string
    url?: string
    size?: number
    filename?: string
  }
  hashProgress: number
}

export interface ChunkUploadProps {
  chunkSize?: number
  concurrency?: number
  maxRetry?: number
  autoStart?: boolean
  resume?: boolean
  maxSize?: number
  maxCount?: number
  accept?: string
  multiple?: boolean
}

export interface ChunkUploadInstance {
  addFiles: (files: File[]) => ChunkUploadTask[]
  start: (uid?: string) => void
  pause: (uid?: string) => void
  resume: (uid?: string) => void
  cancel: (uid?: string) => void
  remove: (uid: string) => void
  retry: (uid: string) => void
  clear: () => void
  getTasks: () => ChunkUploadTask[]
}
