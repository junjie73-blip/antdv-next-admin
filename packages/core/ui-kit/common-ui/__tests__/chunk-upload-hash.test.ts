import SparkMD5 from 'spark-md5';
import { describe, expect, it, vi } from 'vitest';

import { computeFileHash } from '../src/components/chunk-upload/composables/useHashWorker';

/**
 * 自己拼 File，而不是 `new File([...])`。
 *
 * jsdom 27 的 `Blob` 没有 `arrayBuffer()`，而分片哈希正是靠
 * `file.slice(a, b).arrayBuffer()` 逐片取字节 —— 用真 File 只会得到
 * "not a function"，测不到实现。与 `@antdv/hooks/__tests__/helpers/setup.ts`
 * 的 `fakeFile` 同一口径，区别是这里的分片要带**真实字节**，
 * 因为用例要拿 md5 结果跟整文件哈希对账。
 */
function makeFile(size: number, name = 'sample.bin'): File {
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i += 1) bytes[i] = (i * 31 + 7) % 256;

  // 直接切底层 ArrayBuffer（而不是 `bytes.slice()` 再取 buffer）：既拿到副本、
  // 又不用为了 lint 把整段字节 spread 成数组
  const bufferOf = (from: number, to: number) =>
    bytes.buffer.slice(from, to) as ArrayBuffer;

  const blobSlice = (start?: number, end?: number) => {
    const from = start ?? 0;
    const to = Math.min(end ?? size, size);
    return {
      arrayBuffer: () => Promise.resolve(bufferOf(from, to)),
      size: to - from,
    } as unknown as Blob;
  };

  return {
    arrayBuffer: () => Promise.resolve(bufferOf(0, size)),
    name,
    size,
    slice: (start?: number, end?: number) => blobSlice(start, end),
    type: 'application/octet-stream',
  } as unknown as File;
}

/** 一次性读全文件算 md5，作为「分片增量算出来的必须等于它」的基准 */
async function md5OfWholeFile(file: File): Promise<string> {
  const spark = new SparkMD5.ArrayBuffer();
  spark.append(await file.arrayBuffer());
  return spark.end();
}

describe('computeFileHash 主线程兜底路径（宿主没注入 worker 时）', () => {
  it('分片增量哈希与整文件哈希一致', async () => {
    const file = makeFile(1000);
    const task = computeFileHash({ chunkSize: 300, file });

    await expect(task.promise).resolves.toBe(await md5OfWholeFile(file));
  });

  it('0 字节文件直接出空文件 md5，不会卡在等 worker 的 ready', async () => {
    const task = computeFileHash({ chunkSize: 1024, file: makeFile(0) });

    await expect(task.promise).resolves.toBe(
      'd41d8cd98f00b204e9800998ecf8427e',
    );
  });

  it('进度按分片边界推进，最后一片收到的是文件末尾', async () => {
    const received: number[] = [];

    await computeFileHash(
      { chunkSize: 400, file: makeFile(1000) },
      { onProgress: (loaded) => received.push(loaded) },
    ).promise;

    expect(received).toEqual([400, 800, 1000]);
  });

  it('cancel 之后 promise 拒绝，且不再回调 onComplete', async () => {
    const onComplete = vi.fn();
    const task = computeFileHash(
      { chunkSize: 500, file: makeFile(2000) },
      { onComplete },
    );

    task.cancel();

    await expect(task.promise).rejects.toThrow('已取消');
    expect(onComplete).not.toHaveBeenCalled();
  });
});

describe('computeFileHash 的 worker 注入缝', () => {
  /** 假 worker：收到 init 就回 ready，收齐最后一片就回 complete */
  function fakeWorker(totalChunks: number) {
    const posts: any[] = [];
    const emit = (data: any) => worker.onmessage?.({ data } as MessageEvent);

    const worker = {
      onerror: null as ((err: any) => void) | null,
      onmessage: null as ((e: MessageEvent) => void) | null,
      postMessage: vi.fn((message: any) => {
        posts.push(message);
        if (message.type === 'init') {
          queueMicrotask(() => emit({ type: 'ready' }));
        }
        if (message.type === 'chunk' && message.index === totalChunks - 1) {
          queueMicrotask(() => emit({ hash: 'from-worker', type: 'complete' }));
        }
      }),
      terminate: vi.fn(),
    };

    return { posts, worker: worker as unknown as Worker };
  }

  it('注入了 createWorker 就走 worker 协议：init → ready → 逐片 → complete', async () => {
    const file = makeFile(1000);
    const { posts, worker } = fakeWorker(Math.ceil(1000 / 300));
    const createWorker = vi.fn(() => worker);

    const hash = await computeFileHash({
      chunkSize: 300,
      createWorker,
      file,
    }).promise;

    expect(hash).toBe('from-worker');
    expect(createWorker).toHaveBeenCalledTimes(1);
    expect(posts[0]).toEqual({
      fileName: file.name,
      fileSize: 1000,
      totalChunks: 4,
      type: 'init',
    });
    expect(
      posts.filter((message) => message.type === 'chunk').map((m) => m.index),
    ).toEqual([0, 1, 2, 3]);
    // complete 之后必须 terminate，否则每轮上传都留一个活 worker
    expect(worker.terminate).toHaveBeenCalled();
  });

  it('worker 回 error 时把消息原样交给 onError 并拒绝', async () => {
    const worker = {
      onerror: null,
      onmessage: null as ((e: MessageEvent) => void) | null,
      postMessage: vi.fn((message: any) => {
        if (message.type === 'init') {
          queueMicrotask(() =>
            worker.onmessage?.({
              data: { message: '存储写入失败', type: 'error' },
            } as MessageEvent),
          );
        }
      }),
      terminate: vi.fn(),
    };
    const onError = vi.fn();

    const task = computeFileHash(
      {
        chunkSize: 300,
        createWorker: () => worker as unknown as Worker,
        file: makeFile(100),
      },
      { onError },
    );

    await expect(task.promise).rejects.toThrow('存储写入失败');
    expect(onError).toHaveBeenCalledWith('存储写入失败');
  });
});
