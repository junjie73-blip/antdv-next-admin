import {
  CHUNK_SIZE_MAX,
  CHUNK_SIZE_MIN,
  CHUNK_SIZE_PRESETS,
  CHUNK_TARGET_COUNT,
  RESUME_EXPIRE_MS,
  RESUME_STORAGE_PREFIX,
  RETRY_BACKOFF_BASE,
} from "./constants";

/* ============================================================
 * 格式化
 * ============================================================ */

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${(bytes / k ** i).toFixed(decimals)} ${units[i]}`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "--";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function genUid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ============================================================
 * 断点续传本地存储
 * ============================================================ */

interface ResumeRecord {
  hash: string;
  filename: string;
  size: number;
  uploadedChunks: number[];
  updatedAt: number;
}

function resumeKey(hash: string): string {
  return `${RESUME_STORAGE_PREFIX}${hash}`;
}

export function loadResume(hash: string): Set<number> | null {
  try {
    const raw = localStorage.getItem(resumeKey(hash));
    if (!raw) return null;
    const rec: ResumeRecord = JSON.parse(raw);
    if (Date.now() - rec.updatedAt > RESUME_EXPIRE_MS) {
      localStorage.removeItem(resumeKey(hash));
      return null;
    }
    return new Set(rec.uploadedChunks);
  } catch {
    return null;
  }
}

export function saveResume(
  hash: string,
  filename: string,
  size: number,
  uploadedChunks: Set<number>,
): void {
  try {
    const rec: ResumeRecord = {
      hash,
      filename,
      size,
      uploadedChunks: Array.from(uploadedChunks),
      updatedAt: Date.now(),
    };
    localStorage.setItem(resumeKey(hash), JSON.stringify(rec));
  } catch {
    /* ignore */
  }
}

export function clearResume(hash: string): void {
  try {
    localStorage.removeItem(resumeKey(hash));
  } catch {
    /* ignore */
  }
}

/* ============================================================
 * 重试 / 分片
 * ============================================================ */

export function backoffDelay(attempt: number): number {
  return RETRY_BACKOFF_BASE * 2 ** (attempt - 1) + Math.random() * 500;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function sliceFile(file: File, chunkSize: number): Blob[] {
  const chunks: Blob[] = [];
  let offset = 0;
  while (offset < file.size) {
    const end = Math.min(offset + chunkSize, file.size);
    chunks.push(file.slice(offset, end));
    offset = end;
  }
  return chunks;
}
export function hashToUuid(hash: string): string {
  // 兜底：长度不足时用 0 补齐
  const h = hash.padEnd(32, "0").slice(0, 32);

  // variant 位（第 17 位）按 RFC 4122 设为 8/9/a/b 之一
  const variantChar = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);

  return [
    h.slice(0, 8),
    h.slice(8, 12),
    "4" + h.slice(13, 16), // version 4
    variantChar + h.slice(17, 20),
    h.slice(20, 32),
  ].join("-");
}

/**
 * 按文件大小自动计算分片大小
 *
 * 策略：
 *  - 目标分片数 ~ 200，理想大小 = fileSize / 200
 *  - 在预设阶梯里找到 >= 理想值的最小值
 *  - 落在 [MIN, MAX] 区间
 */
export function calcChunkSize(fileSize: number): number {
  if (fileSize <= CHUNK_SIZE_MIN) return fileSize;

  const ideal = Math.ceil(fileSize / CHUNK_TARGET_COUNT);

  if (ideal <= CHUNK_SIZE_MIN) return CHUNK_SIZE_MIN;
  if (ideal >= CHUNK_SIZE_MAX) return CHUNK_SIZE_MAX;

  for (const preset of CHUNK_SIZE_PRESETS) {
    if (preset >= ideal) return preset;
  }
  return CHUNK_SIZE_MAX;
}
