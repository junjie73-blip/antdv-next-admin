import { computed, ref, shallowRef } from "vue";

export interface ChunkInfo {
  index: number;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
}

export type UploadStatus = "idle" | "uploading" | "paused" | "completed" | "error";

export interface ChunkUploadOptions {
  chunkSize?: number;
  concurrent?: number;
  workerUrl?: string;
}

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024;
const DEFAULT_CONCURRENT = 3;

/**
 * 分片上传 composable
 *
 * ⚠️ worker 协议约定：
 *   主线程 → worker:
 *     { type: 'process', chunk: ArrayBuffer, index: number, total: number }
 *    worker → 主线程:
 *     { type: 'progress', index: number, progress: number }   // 0-100
 *     { type: 'chunk-done', index: number, hash?: string }     // 单片完成
 *     { type: 'error', index: number, message: string }        // 单片失败
 */
export function useChunkUpload(options: ChunkUploadOptions = {}) {
  const { chunkSize = DEFAULT_CHUNK_SIZE, concurrent = DEFAULT_CONCURRENT, workerUrl } = options;

  const chunks = ref<ChunkInfo[]>([]);
  const status = ref<UploadStatus>("idle");
  const progress = ref(0);
  const hash = ref("");

  const uploading = computed(() => status.value === "uploading");

  const worker = shallowRef<Worker | null>(null);
  const pausedFlag = shallowRef(false);
  const cancelledFlag = shallowRef(false);
  const currentFile = shallowRef<File | null>(null);

  /** 每个 chunk 的 pending resolve/reject，key 是 index */
  const pendingChunks = new Map<number, { resolve: () => void; reject: (e: Error) => void }>();

  function getWorker(): Worker {
    if (!worker.value) {
      const url = workerUrl || new URL("@/workers/upload.worker.ts", import.meta.url).href;
      worker.value = new Worker(url, { type: "module" });
      // ⭐ 只在创建时挂一次，整个生命周期内不变
      worker.value.addEventListener("message", handleWorkerMessage);
    }
    return worker.value;
  }

  /** 统一的 worker 消息派发 */
  function handleWorkerMessage(e: MessageEvent) {
    const { type, index, progress: chunkProgress, hash: chunkHash, message } = e.data ?? {};

    if (type === "progress") {
      if (typeof index === "number" && chunks.value[index]) {
        chunks.value[index].progress = chunkProgress;
      }
      return;
    }

    if (type === "chunk-done") {
      if (typeof index === "number") {
        if (chunkHash) hash.value = chunkHash;
        pendingChunks.get(index)?.resolve();
        pendingChunks.delete(index);
      }
      return;
    }

    if (type === "error") {
      if (typeof index === "number") {
        const p = pendingChunks.get(index);
        p?.reject(new Error(message || `chunk ${index} failed`));
        pendingChunks.delete(index);
      }
      return;
    }
  }

  function resetState() {
    chunks.value = [];
    progress.value = 0;
    hash.value = "";
    pausedFlag.value = false;
    cancelledFlag.value = false;
    currentFile.value = null;
    pendingChunks.clear();
  }

  function pause() {
    if (status.value === "uploading") {
      pausedFlag.value = true;
      status.value = "paused";
    }
  }

  function resume() {
    if (status.value === "paused" && currentFile.value) {
      pausedFlag.value = false;
      status.value = "uploading";
      processChunks(currentFile.value);
    }
  }

  function cancel() {
    cancelledFlag.value = true;
    // 拒绝所有挂起的 chunk
    pendingChunks.forEach((p) => p.reject(new Error("cancelled")));
    pendingChunks.clear();

    if (worker.value) {
      worker.value.terminate();
      worker.value = null;
    }
    resetState();
    status.value = "idle";
  }

  async function uploadFile(file: File): Promise<void> {
    cancel();

    currentFile.value = file;
    status.value = "uploading";

    const totalChunks = Math.ceil(file.size / chunkSize);
    chunks.value = Array.from({ length: totalChunks }, (_, i) => ({
      index: i,
      status: "pending" as const,
      progress: 0,
    }));

    await processChunks(file);
  }

  /** 单 chunk 处理：等待 worker 回 chunk-done */
  function processOneChunk(w: Worker, file: File, idx: number, total: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (cancelledFlag.value) {
        reject(new Error("cancelled"));
        return;
      }

      // ⭐ 先登记 pending，再发消息，避免 worker 秒回时找不到 handler
      pendingChunks.set(idx, { resolve, reject });

      chunks.value[idx].status = "uploading";
      chunks.value[idx].progress = 0;

      const start = idx * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const slice = file.slice(start, end);

      slice
        .arrayBuffer()
        .then((buffer) => {
          if (cancelledFlag.value || pausedFlag.value) {
            pendingChunks.delete(idx);
            chunks.value[idx].status = "pending";
            reject(new Error("paused-or-cancelled"));
            return;
          }
          // ⭐ 元信息塞进消息里，不再依赖独立的 init
          w.postMessage(
            {
              type: "process",
              chunk: buffer,
              index: idx,
              total,
              chunkSize,
              fileSize: file.size,
            },
            [buffer],
          );
        })
        .catch((err) => {
          pendingChunks.delete(idx);
          chunks.value[idx].status = "error";
          reject(err);
        });
    });
  }

  async function processChunks(file: File): Promise<void> {
    const totalChunks = chunks.value.length;
    if (totalChunks === 0) return;

    const w = getWorker();
    let currentIndex = 0;
    let activeCount = 0;
    let completedCount = 0;
    // 记录已经处理过的 index，resume 时不重复
    const doneSet = new Set<number>();
    // 记录正在处理的 index，避免 resume 时重复 dispatch
    const inflightSet = new Set<number>();

    // 把已完成/正在进行的 index 先记下来（resume 场景）
    chunks.value.forEach((c) => {
      if (c.status === "done") doneSet.add(c.index);
      if (c.status === "uploading") inflightSet.add(c.index);
    });
    completedCount = doneSet.size;

    const updateProgress = () => {
      progress.value = Math.round((completedCount / totalChunks) * 100);
    };
    updateProgress();

    return new Promise<void>((resolve, reject) => {
      let aborted = false;

      const dispatch = () => {
        while (
          !aborted &&
          !cancelledFlag.value &&
          !pausedFlag.value &&
          activeCount < concurrent &&
          currentIndex < totalChunks
        ) {
          const idx = currentIndex++;

          // 已完成的跳过
          if (doneSet.has(idx)) {
            continue;
          }
          // 正在进行的跳过（resume 场景）
          if (inflightSet.has(idx)) {
            activeCount++;
            continue;
          }

          inflightSet.add(idx);
          activeCount++;

          processOneChunk(w, file, idx, totalChunks)
            .then(() => {
              chunks.value[idx].status = "done";
              chunks.value[idx].progress = 100;
              doneSet.add(idx);
              inflightSet.delete(idx);
              completedCount++;
              activeCount--;
              updateProgress();

              if (completedCount >= totalChunks) {
                status.value = "completed";
                resolve();
              } else {
                dispatch();
              }
            })
            .catch((err) => {
              inflightSet.delete(idx);
              activeCount--;

              if (cancelledFlag.value || err?.message === "paused-or-cancelled") {
                // 暂停/取消：不推进，等待 resume
                return;
              }
              chunks.value[idx].status = "error";
              aborted = true;
              status.value = "error";
              reject(err);
            });
        }

        // 全部完成
        if (
          !aborted &&
          !cancelledFlag.value &&
          !pausedFlag.value &&
          completedCount >= totalChunks &&
          activeCount === 0
        ) {
          status.value = "completed";
          resolve();
        }
      };

      dispatch();
    });
  }

  return {
    uploadFile,
    pause,
    resume,
    cancel,
    uploading,
    progress,
    chunks,
    status,
    hash,
  };
}
