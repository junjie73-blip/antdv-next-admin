import SparkMD5 from 'spark-md5';

interface HashWorkerCallbacks {
  onProgress?: (
    received: number,
    total: number,
    percent: number,
    mimeType?: string,
  ) => void;
  onComplete?: (hash: string) => void;
  onError?: (message: string) => void;
}

interface HashTaskOptions {
  /**
   * worker 工厂。`?worker` 是 Vite 的导入语法，公共组件包里不能写死
   * （本包自己的 lib 构建与 vitest 都解析不到那个虚拟模块），
   * 所以哈希后端由宿主注入 —— 宿主侧一行就够：
   *
   *   import HashWorker from '@antdv/common-ui/chunk-upload/upload.worker?worker';
   *   computeFileHash({ file, chunkSize, createWorker: () => new HashWorker() });
   *
   * 不给就走主线程增量哈希：结果与 worker 完全一致（同一套 spark-md5 逐片 append），
   * 只是大文件会占主线程，UI 能动但会卡。
   */
  createWorker?: () => Worker;
  chunkSize: number;
  file: File;
}

export interface HashTask {
  cancel: () => void;
  promise: Promise<string>;
}

/** 与 upload.worker.ts 约定的一致消息协议 */
type WorkerMessage =
  | { type: 'canceled' }
  | { type: 'complete'; hash: string }
  | { type: 'error'; message: string }
  | {
      type: 'progress';
      received: number;
      total: number;
      percent: number;
      mimeType?: string;
    }
  | { type: 'ready' };

export function computeFileHash(
  options: HashTaskOptions,
  callbacks?: HashWorkerCallbacks,
): HashTask {
  const { chunkSize, createWorker, file } = options;

  const totalChunks = Math.ceil(file.size / chunkSize);

  let canceled = false;
  let resolveFn: (hash: string) => void = () => {};
  let rejectFn: (err: Error) => void = () => {};

  const promise = new Promise<string>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  /** 两条路径共用：把结果交给外部观察者并结束 promise */
  function settle(hash: string): void {
    callbacks?.onComplete?.(hash);
    resolveFn(hash);
  }
  function fail(message: string): void {
    callbacks?.onError?.(message);
    rejectFn(new Error(message));
  }

  const worker = createWorker?.() ?? null;

  if (worker) {
    attachWorker(worker);
  } else {
    void hashOnMainThread();
  }

  async function hashOnMainThread(): Promise<void> {
    const spark = new SparkMD5.ArrayBuffer();
    try {
      for (let i = 0; i < totalChunks; i += 1) {
        if (canceled) return;
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const buffer = await file.slice(start, end).arrayBuffer();
        if (canceled) return;
        spark.append(buffer);
        const percent = Math.round(((i + 1) / totalChunks) * 100);
        callbacks?.onProgress?.(end, file.size, percent);
      }
      if (canceled) return;
      settle(spark.end());
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
    }
  }

  function attachWorker(instance: Worker): void {
    instance.onmessage = (e: MessageEvent) => {
      const msg = e.data as WorkerMessage;

      switch (msg.type) {
        case 'ready': {
          void feedChunks(instance);
          break;
        }
        case 'progress': {
          callbacks?.onProgress?.(
            msg.received,
            msg.total,
            msg.percent,
            msg.mimeType,
          );
          break;
        }
        case 'complete': {
          cleanup(instance);
          settle(msg.hash);
          break;
        }
        case 'error': {
          cleanup(instance);
          fail(msg.message);
          break;
        }
        case 'canceled': {
          cleanup(instance);
          rejectFn(new Error('已取消'));
          break;
        }
      }
    };

    instance.onerror = (err) => {
      cleanup(instance);
      rejectFn(new Error(err.message || 'Worker 异常'));
    };

    instance.postMessage({
      type: 'init',
      fileName: file.name,
      fileSize: file.size,
      totalChunks,
    });
  }

  async function feedChunks(instance: Worker): Promise<void> {
    try {
      for (let i = 0; i < totalChunks; i++) {
        if (canceled) return;

        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const blob = file.slice(start, end);
        const buffer = await blob.arrayBuffer();

        if (canceled) return;
        instance.postMessage({ type: 'chunk', index: i, buffer }, [buffer]);
      }
    } catch (error) {
      cleanup(instance);
      rejectFn(error instanceof Error ? error : new Error(String(error)));
    }
  }

  function cancel(): void {
    if (canceled) return;
    canceled = true;
    if (worker) {
      try {
        worker.postMessage({ type: 'cancel' });
        cleanup(worker);
      } catch {
        /* ignore */
      }
    }
    rejectFn(new Error('已取消'));
  }

  return { cancel, promise };
}

function cleanup(worker: Worker): void {
  try {
    worker.terminate();
  } catch {
    /* ignore */
  }
}
