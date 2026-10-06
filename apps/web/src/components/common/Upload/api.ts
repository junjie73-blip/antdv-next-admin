import { request } from '~/composables';

/* ============================================================
 * 类型
 * ============================================================ */
export interface UploadedFileResult {
  fileId: string;
  filename: string;
  url: string;
  size: number;
  mimeType?: string;
}

export interface ChunkCheckResult {
  uploadedChunks: number[];
  uploadedBytes?: number;
  uploaded?: boolean;
}

export interface ChunkMergeResult {
  taskId: string;
  status: 'completed' | 'failed' | 'merging' | 'pending' | 'uploading';
}

export type InstantCheckResult =
  | { hit: false }
  | { hit: true; fileId: string; url: string; size: number; filename: string };

export type ProgressCallback = (loaded: number, total: number) => void;

/* ============================================================
 * 小文件上传
 * ============================================================ */
export function uploadSingleFile(
  file: File,
  extraData?: Record<string, unknown>,
): Promise<UploadedFileResult> {
  const formData = new FormData();
  formData.append('file', file);
  if (extraData) {
    for (const [k, v] of Object.entries(extraData)) {
      if (v !== undefined && v !== null) formData.append(k, String(v));
    }
  }

  return request.post<{
    code: number;
    data: UploadedFileResult;
    message?: string;
  }>('/upload/file', formData, {
    timeout: 5 * 60 * 1000,
  });
}

/* ============================================================
 * ⭐ 分片续传检查（GET）
 * ============================================================ */
export function checkChunks(
  uploadId: string,
  filename: string,
  size: number,
  totalChunks?: number,
): Promise<ChunkCheckResult> {
  return request
    .get<{ code: number; data: ChunkCheckResult }>(
      '/upload/check',
      { uploadId, filename, size, totalChunks },
      { timeout: 10 * 1000 },
    )
    .then((res) => res.data);
}

/* ============================================================
 * ⭐ 秒传检查（POST）
 * ============================================================ */
export function checkInstant(input: {
  fileHash: string;
  fileSize: number;
  filename: string;
}): Promise<InstantCheckResult> {
  return request
    .post<{ code: number; data: InstantCheckResult }>('/upload/check', input, {
      timeout: 10 * 1000,
    })
    .then((res) => res.data);
}

/* ============================================================
 * ⭐ 上传单个分片（60s 超时）
 * ============================================================ */
export function uploadChunk(params: {
  uploadId: string;
  index: number;
  total: number;
  chunk: Blob;
  filename: string;
}): Promise<void> {
  const { uploadId, index, total, chunk, filename } = params;

  const formData = new FormData();
  formData.append('uploadId', uploadId);
  formData.append('chunkIndex', String(index));
  formData.append('totalChunks', String(total));
  formData.append('file', chunk, `${filename}.part${index}`);

  return request.post<{ code: number; message?: string }>(
    '/upload/chunk',
    formData,
    {
      timeout: 60 * 1000,
      retries: 0,
    },
  );
}

/* ============================================================
 * 合并分片
 * ============================================================ */
export function mergeChunks(params: {
  uploadId: string;
  filename: string;
  size: number;
  totalChunks: number;
  mimeType?: string;
  fileHash?: string;
}): Promise<ChunkMergeResult> {
  return request
    .post<{ code: number; data: ChunkMergeResult; message?: string }>(
      '/upload/merge',
      params,
      {
        timeout: 50 * 60 * 1000,
      },
    )
    .then((res) => res.data);
}

/* ============================================================
 * 删除物理文件
 * ============================================================ */
export function deletePhysicalFile(url: string): Promise<void> {
  return request.post<{ code: number; message?: string }>('/upload/delete', {
    url,
  });
}

export const getMergeStatus = (taskId: string) => {
  return request
    .get<{ code: number; data: any; message?: string }>(
      '/upload/merge/status',
      { taskId },
    )
    .then((res) => res.data);
};
