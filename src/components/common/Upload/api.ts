import { http } from "@/utils";

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
  /** 是否秒传 */
  uploaded?: boolean;
  /** 已上传的分片索引 */
  uploadedChunks?: number[];
  /** 秒传时返回的文件记录 */
  result?: UploadedFileResult;
}

export interface ChunkMergeResult {
  taskId: string;
  /** 合并状态 */
  status: "pending" | "merging" | "uploading" | "completed" | "failed";
}

/** 进度回调 */
export type ProgressCallback = (loaded: number, total: number) => void;

/* ============================================================
 * 小文件上传
 * ============================================================
 * 说明：
 *  - 走系统 http，自动带认证头 / 租户头 / 请求签名
 *  - 支持上传进度
 */
export function uploadSingleFile(
  file: File,
  extraData?: Record<string, unknown>,
): Promise<UploadedFileResult> {
  const formData = new FormData();
  formData.append("file", file);
  if (extraData) {
    for (const [k, v] of Object.entries(extraData)) {
      if (v !== undefined && v !== null) formData.append(k, String(v));
    }
  }

  return http.Post<{ code: number; data: UploadedFileResult; message?: string }>(
    "/upload/file",
    formData,
  );
}

/* ============================================================
 * 检查已上传分片
 * ============================================================
 * 说明：
 *  - GET 请求，query 参数 uploadId = hash
 *  - 响应 data.uploaded = true 表示秒传
 */
export function checkChunks(
  uploadId: string,
  filename: string,
  size: number,
): Promise<ChunkCheckResult> {
  return http.Get<{ code: number; data: ChunkCheckResult; message?: string }>("/upload/check", {
    params: { uploadId, filename, size },
  });
}

/* ============================================================
 * 上传单个分片
 * ============================================================
 * 说明：
 *  - POST multipart，字段：uploadId / index / total / chunk
 *  - 单分片内不细化进度，分片是"原子上传"，完成后靠累计更新进度
 */
export function uploadChunk(params: {
  uploadId: string;
  index: number;
  total: number;
  chunk: Blob;
  filename: string;
}): Promise<void> {
  const { uploadId, index, total, chunk, filename } = params;

  const formData = new FormData();
  formData.append("uploadId", uploadId);
  formData.append("chunkIndex", String(index));
  formData.append("totalChunks", String(total));
  formData.append("file", chunk, `${filename}.part${index}`);

  return http.Post<{ code: number; message?: string }>("/upload/chunk", formData);
}

/* ============================================================
 * 合并分片
 * ============================================================
 * 说明：
 *  - 后端合并时同步写 sys_file
 *  - 响应 data.result 是最终文件记录
 */
export function mergeChunks(params: {
  uploadId: string;
  filename: string;
  size: number;
  totalChunks: number;
  mimeType?: string;
}): Promise<ChunkMergeResult> {
  return http.Post<{
    code: number;
    data: ChunkMergeResult;
    message?: string;
  }>("/upload/merge", params, {
    timeout: 50 * 60 * 60,
  });
}

/* ============================================================
 * 删除物理文件（可选）
 * ============================================================ */
export function deletePhysicalFile(url: string): Promise<void> {
  return http.Post<{ code: number; message?: string }>("/upload/delete", { url });
}
