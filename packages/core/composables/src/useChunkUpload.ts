import { computed, ref, shallowRef } from 'vue';

export interface ChunkInfo {
  index: number;
  status: 'done' | 'error' | 'pending' | 'uploading';
  progress: number;
}

export type UploadStatus =
  | 'completed'
  | 'error'
  | 'idle'
  | 'paused'
  | 'uploading';

/** 发给 worker 的单片描述：元信息随消息一起走，不依赖额外的 init 轮次 */
export interface ChunkMessage {
  chunk: ArrayBuffer;
  chunkSize: number;
  fileSize: number;
  index: number;
  total: number;
  type: 'process';
}

export interface ChunkUploadOptions {
  chunkSize?: number;
  concurrent?: number;
  /**
   * worker 工厂。Vite 下推荐这种用法，因为 `?worker` 导入的是构造器而不是 URL：
   *
   *   import HashWorker from '~/components/common/Upload/upload.worker?worker';
   *   useChunkUpload({ createWorker: () => new HashWorker() });
   */
  createWorker?: () => Worker;
  /** worker 脚本 URL：与 createWorker 二选一 */
  workerUrl?: string;
}

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024;
const DEFAULT_CONCURRENT = 3;

/** 一次正在进行的调度：pause/resume/cancel 都必须作用在同一个 run 上 */
interface ActiveRun {
  /** 暂停后恢复：继续推进同一条 promise */
  dispatch: () => void;
  /** 取消：仅拒绝 promise，不复用 settleFail 的失败语义 */
  reject: (error: Error) => void;
  resolve: () => void;
}

/**
 * 分片调度 composable
 *
 * 职责边界：只负责「切片 + 并发 + 进度 + 暂停/恢复/取消」，
 * 不关心后端接口长什么样，也不内置任何哈希算法。
 * 「这一片到底怎么处理」交给 worker，于是同一套调度逻辑既能接秒传哈希，
 * 也能接分片直传，还能在测试里完全不启 worker。
 *
 * ⚠️ worker 协议约定：
 *   主线程 → worker:
 *     { type: 'process', chunk, index, total, chunkSize, fileSize }
 *   worker → 主线程:
 *     { type: 'progress', index: number, progress: number }  // 0-100
 *     { type: 'chunk-done', index: number, hash?: string }    // 单片完成
 *     { type: 'error', index: number, message: string }       // 单片失败
 *
 * 既不给 createWorker 也不给 workerUrl 时走「主线程模式」：只切片读进内存，
 * 不算哈希（hash 恒为空串）。用于小文件、单元测试，以及 worker 未就绪时的降级。
 *
 * 关于 pause/resume：它们必须复用同一个 Promise。早期实现是 resume() 里再调一次
 * 调度函数，于是调用方 `await uploadFile()` 永远等不到结束——等待的那条 promise
 * 已经随着暂停被丢掉了，新的 promise 没人 await。现在把调度闭包挂在 activeRun 上，
 * resume 只是让同一条 promise 继续推进。
 */
export function useChunkUpload(options: ChunkUploadOptions = {}) {
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    concurrent = DEFAULT_CONCURRENT,
    createWorker,
    workerUrl,
  } = options;

  const chunks = ref<ChunkInfo[]>([]);
  const status = ref<UploadStatus>('idle');
  const progress = ref(0);
  const hash = ref('');

  const uploading = computed(() => status.value === 'uploading');

  const worker = shallowRef<null | Worker>(null);
  const pausedFlag = shallowRef(false);
  const cancelledFlag = shallowRef(false);
  const currentFile = shallowRef<File | null>(null);

  /** 每个 chunk 的 pending resolve/reject，key 是 index */
  const pendingChunks = new Map<
    number,
    { resolve: () => void; reject: (e: Error) => void }
  >();

  /** 每次 cancel/重新上传都 +1，用来识别「这条回调属于已经作废的 run」 */
  let runId = 0;
  let activeRun: ActiveRun | null = null;

  /**
   * 修改单片状态。
   * 不写 `chunks.value[i].status = ...`：开了 noUncheckedIndexedAccess 之后
   * 下标结果含 undefined，先取局部变量既省重复下标也避免静默吞错。
   */
  function patchChunk(index: number, patch: Partial<ChunkInfo>) {
    const target = chunks.value[index];
    if (!target) return;
    Object.assign(target, patch);
  }

  /** 只有调用方提供了 worker 来源才创建；否则返回 null，走主线程模式 */
  function getWorker(): null | Worker {
    if (worker.value) return worker.value;
    if (!createWorker && !workerUrl) return null;

    const instance = createWorker
      ? createWorker()
      : new Worker(workerUrl!, { type: 'module' });
    worker.value = instance;
    // ⭐ 只在创建时挂一次，整个生命周期内不变
    instance.addEventListener('message', handleWorkerMessage);
    return instance;
  }

  /** 统一的 worker 消息派发 */
  function handleWorkerMessage(e: MessageEvent) {
    const {
      type,
      index,
      progress: chunkProgress,
      hash: chunkHash,
      message,
    } = e.data ?? {};

    if (type === 'progress') {
      if (typeof index === 'number') {
        patchChunk(index, { progress: chunkProgress });
      }
      return;
    }

    if (type === 'chunk-done') {
      if (typeof index === 'number') {
        if (chunkHash) hash.value = chunkHash;
        pendingChunks.get(index)?.resolve();
        pendingChunks.delete(index);
      }
      return;
    }

    if (type === 'error') {
      if (typeof index === 'number') {
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
    hash.value = '';
    pausedFlag.value = false;
    cancelledFlag.value = false;
    currentFile.value = null;
    pendingChunks.clear();
  }

  function terminateWorker() {
    if (!worker.value) return;
    try {
      worker.value.terminate();
    } catch {
      /* terminate 在部分环境会抛，不影响主流程 */
    }
    worker.value = null;
  }

  function pause() {
    if (status.value === 'uploading') {
      pausedFlag.value = true;
      status.value = 'paused';
    }
  }

  function resume() {
    if (status.value !== 'paused' || !currentFile.value) return;

    pausedFlag.value = false;
    status.value = 'uploading';

    // ⭐ 继续原来那条 run，不要新起一条 promise（否则外层 await 永远不返回）
    if (activeRun) {
      activeRun.dispatch();
      return;
    }
    void processChunks(currentFile.value);
  }

  function cancel() {
    // 先让所有在途回调失效，再拒绝 pending：
    // 否则 chunk 的 catch 会在微任务里跑到，此时 cancelledFlag 已被 resetState 复位，
    // 一次普通取消会被误判成「分片失败」，状态停在 error。
    runId++;
    const run = activeRun;
    activeRun = null;

    cancelledFlag.value = true;
    pendingChunks.forEach((p) => p.reject(new Error('cancelled')));
    pendingChunks.clear();

    terminateWorker();
    resetState();
    status.value = 'idle';

    // 给 await uploadFile() 的调用方一个明确的取消信号
    run?.reject(new Error('cancelled'));
  }

  async function uploadFile(file: File): Promise<void> {
    cancel();

    currentFile.value = file;
    status.value = 'uploading';

    const totalChunks = Math.ceil(file.size / chunkSize);
    chunks.value = Array.from({ length: totalChunks }, (_, i) => ({
      index: i,
      status: 'pending' as const,
      progress: 0,
    }));

    return processChunks(file);
  }

  /** 单 chunk 处理：worker 模式等 chunk-done，主线程模式读完即完成 */
  function processOneChunk(
    w: null | Worker,
    file: File,
    idx: number,
    total: number,
    myRunId: number,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (cancelledFlag.value || myRunId !== runId) {
        reject(new Error('cancelled'));
        return;
      }

      // ⭐ 先登记 pending，再发消息，避免 worker 秒回时找不到 handler
      pendingChunks.set(idx, { resolve, reject });

      patchChunk(idx, { progress: 0, status: 'uploading' });

      const start = idx * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const slice = file.slice(start, end);

      slice
        .arrayBuffer()
        .then((buffer) => {
          if (myRunId !== runId) {
            pendingChunks.delete(idx);
            reject(new Error('cancelled'));
            return;
          }

          if (cancelledFlag.value || pausedFlag.value) {
            pendingChunks.delete(idx);
            patchChunk(idx, { status: 'pending' });
            reject(new Error('paused-or-cancelled'));
            return;
          }

          if (!w) {
            // 主线程模式：没有哈希后端，读完就算这一片完成
            pendingChunks.delete(idx);
            resolve();
            return;
          }

          const message: ChunkMessage = {
            type: 'process',
            chunk: buffer,
            index: idx,
            total,
            chunkSize,
            fileSize: file.size,
          };
          // ⭐ 元信息塞进消息里，不再依赖独立的 init；buffer 转移所有权零拷贝
          w.postMessage(message, [buffer]);
        })
        .catch((error: unknown) => {
          pendingChunks.delete(idx);
          patchChunk(idx, { status: 'error' });
          reject(error);
        });
    });
  }

  function processChunks(file: File): Promise<void> {
    const totalChunks = chunks.value.length;
    if (totalChunks === 0) {
      // 0 字节文件：没有分片要跑，但对外语义仍是「传完了」
      progress.value = 100;
      status.value = 'completed';
      return Promise.resolve();
    }

    const myRunId = runId;
    const w = getWorker();
    let currentIndex = 0;
    let activeCount = 0;
    let completedCount = 0;
    // 记录已经处理过的 index，resume 时不重复
    const doneSet = new Set<number>();
    // 记录正在处理的 index，避免 resume 时重复 dispatch
    const inflightSet = new Set<number>();

    // 把已完成/正在进行的 index 先记下来（resume 兜底重排场景）
    chunks.value.forEach((c) => {
      if (c.status === 'done') doneSet.add(c.index);
      if (c.status === 'uploading') inflightSet.add(c.index);
    });
    completedCount = doneSet.size;

    const updateProgress = () => {
      progress.value = Math.round((completedCount / totalChunks) * 100);
    };
    updateProgress();

    return new Promise<void>((resolve, reject) => {
      let aborted = false;

      const settleOk = () => {
        status.value = 'completed';
        activeRun = null;
        resolve();
      };

      const settleFail = (error: Error) => {
        aborted = true;
        status.value = 'error';
        activeRun = null;
        reject(error);
      };

      /**
       * 取消专用：只把 promise 拒掉，不改 status。
       * cancel() 已经把状态复位成 idle，这里再走 settleFail 会把它覆盖成 error，
       * 调用方就会看到「取消完了，但状态是失败」。
       */
      const abortRun = (error: Error) => {
        aborted = true;
        reject(error);
      };

      const dispatch = () => {
        while (
          !aborted &&
          !cancelledFlag.value &&
          !pausedFlag.value &&
          myRunId === runId &&
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

          processOneChunk(w, file, idx, totalChunks, myRunId)
            .then(() => {
              patchChunk(idx, { progress: 100, status: 'done' });
              doneSet.add(idx);
              inflightSet.delete(idx);
              completedCount++;
              activeCount--;
              updateProgress();

              if (myRunId !== runId) return;

              if (completedCount >= totalChunks) {
                settleOk();
              } else {
                dispatch();
              }
            })
            .catch((error: unknown) => {
              inflightSet.delete(idx);
              activeCount--;

              // 取消：cancel() 已经 reject 过这条 run，这里不再重复处理
              if (myRunId !== runId || cancelledFlag.value) return;

              const message =
                error instanceof Error ? error.message : String(error);
              if (message === 'paused-or-cancelled') {
                // 暂停：不推进也不失败，等 resume 唤醒同一条 run
                return;
              }

              patchChunk(idx, { status: 'error' });
              settleFail(
                error instanceof Error ? error : new Error(String(error)),
              );
            });
        }

        // 全部完成：剩下的分片都在 doneSet 里（resume 后只剩已完成的）时靠这里收尾
        if (
          !aborted &&
          !cancelledFlag.value &&
          !pausedFlag.value &&
          myRunId === runId &&
          completedCount >= totalChunks &&
          activeCount === 0
        ) {
          settleOk();
        }
      };

      activeRun = { dispatch, reject: abortRun, resolve: settleOk };
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
