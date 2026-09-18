import { ref, type Ref } from "vue";

import {
  CHUNK_SIZE_MAX,
  CHUNK_SIZE_MIN,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_CONCURRENCY,
  DEFAULT_MAX_RETRY,
  SPEED_WINDOW_MS,
} from "../constants";

import { computeFileHash } from "./useHashWorker";
import { checkChunks, mergeChunks, uploadChunk as uploadChunkApi } from "../api";

import {
  backoffDelay,
  calcChunkSize,
  clearResume,
  genUid,
  hashToUuid,
  loadResume,
  saveResume,
  sleep,
  sliceFile,
} from "../utils";

import type { ChunkUploadTask, UploadStatus } from "../types";

/* ============================================================
 * Hook
 * ============================================================ */

interface UseChunkUploaderOptions {
  chunkSize?: number;
  concurrency?: number;
  maxRetry?: number;

  /** 任务状态变化 */
  onUpdate?: (task: ChunkUploadTask) => void;

  /** 分片全部上传完，开始合并（用于提示用户"可以关闭窗口"） */
  onMergeStart?: (task: ChunkUploadTask) => void;

  /** 上传成功（仅分片上传成功，合并成功由 WS 侧处理） */
  onSuccess?: (task: ChunkUploadTask) => void;

  /** 上传失败 */
  onError?: (task: ChunkUploadTask) => void;
}

export function useChunkUploader(options: UseChunkUploaderOptions = {}) {
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    concurrency = DEFAULT_CONCURRENCY,
    maxRetry = DEFAULT_MAX_RETRY,
    onUpdate,
    onMergeStart,
    onSuccess,
    onError,
  } = options;

  const tasks = ref(new Map<string, ChunkUploadTask>());
  const aborters = new Map<string, AbortController>();
  const speedWindow = new Map<string, Array<{ t: number; loaded: number }>>();

  /* ============================================================
   * 通用
   * ============================================================ */

  function notify(task: ChunkUploadTask): void {
    onUpdate?.(task);
  }

  function setStatus(task: ChunkUploadTask, status: UploadStatus, error?: string): void {
    task.status = status;
    if (error !== undefined) task.error = error;
    tasks.value.set(task.uid, task);
    notify(task);
  }

  function updateSpeed(task: ChunkUploadTask): void {
    const now = Date.now();
    const win = speedWindow.get(task.uid) ?? [];
    win.push({ t: now, loaded: task.loaded });
    while (win.length > 0 && now - win[0]!.t > SPEED_WINDOW_MS) win.shift();
    speedWindow.set(task.uid, win);

    if (win.length >= 2) {
      const first = win[0]!;
      const last = win[win.length - 1]!;
      const dt = (last.t - first.t) / 1000;
      const dl = last.loaded - first.loaded;
      task.speed = dt > 0 ? dl / dt : 0;
      task.remaining = task.speed > 0 ? (task.total - task.loaded) / task.speed : 0;
    } else {
      task.speed = 0;
      task.remaining = 0;
    }
  }

  /* ============================================================
   * 1. hash（worker）
   * ============================================================ */

  function computeHash(task: ChunkUploadTask, signal: AbortSignal): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const hashTask = computeFileHash(
        { file: task.file, chunkSize: task.chunkSize },
        {
          onProgress: (_r, _t, percent) => {
            task.hashProgress = percent;
            notify(task);
          },
          onComplete: (hash) => {
            task.hashProgress = 100;
            resolve(hash);
          },
          onError: (msg) => reject(new Error(msg)),
        },
      );

      signal.addEventListener(
        "abort",
        () => {
          hashTask.cancel();
          reject(new DOMException("Aborted", "AbortError"));
        },
        { once: true },
      );

      hashTask.promise.catch(() => {
        /* 由 abort 统一处理 */
      });
    });
  }

  /* ============================================================
   * 2. 单分片上传（含重试）
   * ============================================================ */

  async function uploadChunkWithRetry(
    task: ChunkUploadTask,
    chunk: Blob,
    index: number,
    signal: AbortSignal,
  ): Promise<void> {
    let attempt = 0;
    while (attempt <= maxRetry) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");

      try {
        await uploadChunkApi({
          uploadId: task.uploadId!,
          index,
          total: task.totalChunks,
          chunk,
          filename: task.filename,
        });

        task.uploadedChunks.add(index);
        task.loaded += chunk.size;
        updateSpeed(task);
        saveResume(task.hash!, task.filename, task.size, task.uploadedChunks);
        notify(task);
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") throw err;
        attempt++;
        if (attempt > maxRetry) {
          throw new Error(`分片 ${index} 失败：${(err as Error).message}`);
        }
        task.retryCount++;
        notify(task);
        await sleep(backoffDelay(attempt));
      }
    }
  }

  /* ============================================================
   * 3. 并发池
   * ============================================================ */

  async function runWithConcurrency<T>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<void>,
  ): Promise<void> {
    let cursor = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const idx = cursor++;
        await worker(items[idx]!);
      }
    });
    await Promise.all(runners);
  }

  /* ============================================================
   * 4. 主流程
   * ============================================================ */

  async function startTask(task: ChunkUploadTask): Promise<void> {
    if (task.status === "uploading" || task.status === "hashing" || task.status === "merging") {
      return;
    }

    const aborter = new AbortController();
    aborters.set(task.uid, aborter);

    try {
      /* ---------- 1. hash ---------- */
      if (!task.hash) {
        setStatus(task, "hashing");
        task.hashProgress = 0;
        task.hash = await computeHash(task, aborter.signal);
      }

      if (!task.uploadId) {
        task.uploadId = hashToUuid(task.hash);
      }

      /* ---------- 2. 断点检查 ---------- */
      setStatus(task, "uploading");
      const checkData = await checkChunks(task.uploadId, task.filename, task.size);
      const remoteUploaded = new Set(checkData.uploadedChunks);

      // 秒传
      if (task.totalChunks > 0 && remoteUploaded.size >= task.totalChunks) {
        task.loaded = task.total;
        task.uploadedChunks = new Set(Array.from({ length: task.totalChunks }, (_, i) => i));
        setStatus(task, "success");
        clearResume(task.hash!);
        onSuccess?.(task);
        return;
      }

      /* ---------- 3. 合并本地 + 远端分片 ---------- */
      const chunkBlobs = sliceFile(task.file, task.chunkSize);
      task.totalChunks = chunkBlobs.length;

      const localUploaded = loadResume(task.hash!) ?? new Set<number>();
      const merged = new Set<number>([...remoteUploaded, ...localUploaded]);
      task.uploadedChunks = merged;

      task.loaded = 0;
      for (const i of merged) {
        const blob = chunkBlobs[i];
        if (blob) task.loaded += blob.size;
      }
      notify(task);

      /* ---------- 4. 并发上传剩余分片 ---------- */
      const pending: Array<{ index: number; blob: Blob }> = [];
      for (let i = 0; i < chunkBlobs.length; i++) {
        if (!merged.has(i)) pending.push({ index: i, blob: chunkBlobs[i]! });
      }

      await runWithConcurrency(pending, concurrency, async ({ index, blob }) => {
        if (aborter.signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        await uploadChunkWithRetry(task, blob, index, aborter.signal);
      });

      /* ---------- 5. 合并 ---------- */
      setStatus(task, "merging");
      task.mergeStartedAt = Date.now();

      const mergeResult = await mergeChunks({
        uploadId: task.uploadId,
        filename: task.filename,
        size: task.size,
        totalChunks: task.totalChunks,
        mimeType: task.mimeType,
      });

      task.taskId = mergeResult.taskId;
      task.mergeStatus = mergeResult.status;

      // ⭐ merge 成功返回 → 分片已交付后端，清理本地断点
      clearResume(task.hash!);
      task.uploadedChunks.clear();
      task.loaded = task.total;
      task.retryCount = 0;

      notify(task);

      // 通知 UI：分片上传完成，已进入合并阶段
      onMergeStart?.(task);

      // 后端同步完成（罕见）
      if (mergeResult.status === "completed") {
        task.mergeStatus = "completed";
        setStatus(task, "success");
        onSuccess?.(task);
      }

      // 异步完成：hook 到此结束，后续由 ws.ts 处理
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setStatus(task, "paused");
      } else {
        setStatus(task, "error", (err as Error).message || "上传失败");
        onError?.(task);
      }
    } finally {
      aborters.delete(task.uid);
      speedWindow.delete(task.uid);
    }
  }

  /* ============================================================
   * 对外 API
   * ============================================================ */

  function addFiles(files: File[]): ChunkUploadTask[] {
    const created: ChunkUploadTask[] = [];
    for (const file of files) {
      const effectiveChunkSize = resolveChunkSize(file.size);
      const totalChunks = Math.ceil(file.size / effectiveChunkSize);
      const task: ChunkUploadTask = {
        uid: genUid(),
        file,
        filename: file.name,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        status: "waiting",
        loaded: 0,
        total: file.size,
        chunkSize,
        totalChunks,
        uploadedChunks: new Set(),
        speed: 0,
        remaining: 0,
        retryCount: 0,
        hashProgress: 0,
      };
      tasks.value.set(task.uid, task);
      created.push(task);
      notify(task);
    }
    return created;
  }

  function start(uid?: string): void {
    if (uid) {
      const t = tasks.value.get(uid);
      if (t) void startTask(t);
      return;
    }
    tasks.value.forEach((t) => {
      if (t.status === "waiting") void startTask(t);
    });
  }

  function pause(uid?: string): void {
    const targets = uid
      ? ([tasks.value.get(uid)].filter(Boolean) as ChunkUploadTask[])
      : Array.from(tasks.value.values());
    for (const t of targets) {
      if (t.status === "uploading" || t.status === "hashing" || t.status === "merging") {
        aborters.get(t.uid)?.abort();
      }
    }
  }

  function resume(uid?: string): void {
    const targets = uid
      ? ([tasks.value.get(uid)].filter(Boolean) as ChunkUploadTask[])
      : Array.from(tasks.value.values());
    for (const t of targets) {
      if (t.status === "paused" || t.status === "error") void startTask(t);
    }
  }

  function cancel(uid?: string): void {
    const targets = uid
      ? ([tasks.value.get(uid)].filter(Boolean) as ChunkUploadTask[])
      : Array.from(tasks.value.values());
    for (const t of targets) {
      aborters.get(t.uid)?.abort();
      setStatus(t, "canceled");
      if (t.hash) clearResume(t.hash);
    }
  }

  function remove(uid: string): void {
    cancel(uid);
    tasks.value.delete(uid);
  }

  function retry(uid: string): void {
    const t = tasks.value.get(uid);
    if (t && t.status === "error") void startTask(t);
  }

  function clear(): void {
    cancel();
    tasks.value.clear();
  }

  function getTasks(): ChunkUploadTask[] {
    return Array.from(tasks.value.values());
  }
  function resolveChunkSize(fileSize: number): number {
    if (chunkSize && chunkSize > 0) {
      return Math.min(CHUNK_SIZE_MAX, Math.max(CHUNK_SIZE_MIN, chunkSize));
    }
    return calcChunkSize(fileSize);
  }
  return {
    tasks: tasks as Ref<Map<string, ChunkUploadTask>>,
    addFiles,
    start,
    pause,
    resume,
    cancel,
    remove,
    retry,
    clear,
    getTasks,
  };
}

export type UseChunkUploaderReturn = ReturnType<typeof useChunkUploader>;
