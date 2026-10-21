// ============================================================
// API（供外部直接调用）
// ============================================================
export {
  checkChunks,
  deletePhysicalFile,
  mergeChunks,
  uploadChunk,
  uploadSingleFile,
} from './api';

export type {
  ChunkCheckResult,
  ChunkMergeResult,
  ProgressCallback,
  UploadedFileResult,
} from './api';
export { default as ChunkUpload } from './ChunkUpload.vue';
// ============================================================
// Composable
// ============================================================
export { useChunkUploader } from './composables/useChunkUploader';
export type { UseChunkUploaderReturn } from './composables/useChunkUploader';
export { computeFileHash } from './composables/useHashWorker';

export type { HashTask } from './composables/useHashWorker';
export { DEFAULT_CHUNK_SIZE, UploadErrorCode } from './constants';
export type { UploadErrorInfo } from './constants';
export { default as FileUpload } from './FileUpload.vue';

// ============================================================
// 类型
// ============================================================
export type {
  ChunkUploadInstance,
  ChunkUploadProps,
  ChunkUploadTask,
  FileUploadInstance,
  FileUploadProps,
  UploadStatus,
} from './types';
// 基础 Upload 的类型从这里转发：用它就不必再 import 一层 `@antdv/common-ui`
export type { UploadChangeParam, UploadFile } from './types';

// ============================================================
// 工具
// ============================================================
export { formatBytes, formatDuration } from './utils';
