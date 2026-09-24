// ============================================================
// 类型
// ============================================================
export type {
  ChunkUploadInstance,
  ChunkUploadProps,
  ChunkUploadTask,
  UploadInstance,
  UploadProps,
  UploadStatus,
} from './types'

// ============================================================
// 组件
// ============================================================
export { default as Upload } from './Upload.vue'
export { default as ChunkUpload } from './ChunkUpload.vue'

// ============================================================
// Composable
// ============================================================
export { useChunkUploader } from './composables/useChunkUploader'
export type { UseChunkUploaderReturn } from './composables/useChunkUploader'
export { computeFileHash } from './composables/useHashWorker'
export type { HashTask } from './composables/useHashWorker'

// ============================================================
// API（供外部直接调用）
// ============================================================
export { checkChunks, deletePhysicalFile, mergeChunks, uploadChunk, uploadSingleFile } from './api'
export type { ChunkCheckResult, ChunkMergeResult, ProgressCallback, UploadedFileResult } from './api'

// ============================================================
// 工具
// ============================================================
export { formatBytes, formatDuration } from './utils'
