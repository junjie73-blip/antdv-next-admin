import { describe, expect, it, vi } from 'vitest';

import { useChunkUpload } from '../src/useChunkUpload';
import { fakeFile, fakeWorker, flush } from './helpers/setup';

describe('useChunkUpload · 主线程模式', () => {
  it('不注入 worker 时也能跑完：切片、进度到 100、状态 completed', async () => {
    const uploader = useChunkUpload({ chunkSize: 4 });
    const promise = uploader.uploadFile(fakeFile(10)); // → 3 片

    await expect(promise).resolves.toBeUndefined();
    expect(uploader.status.value).toBe('completed');
    expect(uploader.progress.value).toBe(100);
    expect(uploader.chunks.value.map((c) => c.index)).toEqual([0, 1, 2]);
    expect(uploader.chunks.value.every((c) => c.status === 'done')).toBe(true);
    // 没有哈希后端时 hash 保持空串，而不是 undefined
    expect(uploader.hash.value).toBe('');
    expect(uploader.uploading.value).toBe(false);
  });

  it('空文件不产生分片，直接完成', async () => {
    const uploader = useChunkUpload({ chunkSize: 4 });
    await uploader.uploadFile(fakeFile(0));
    expect(uploader.chunks.value).toEqual([]);
    expect(uploader.status.value).toBe('completed');
  });

  it('最后一片按剩余大小切，不越过 fileSize', async () => {
    const worker = fakeWorker();
    const uploader = useChunkUpload({
      chunkSize: 4,
      concurrent: 1,
      createWorker: () => worker.worker,
    });

    void uploader.uploadFile(fakeFile(10));
    await flush();

    const messages = worker.postMessage as Array<{
      chunkSize: number;
      fileSize: number;
      index: number;
      total: number;
      type: string;
    }>;
    expect(messages[0]!.type).toBe('process');
    expect(messages[0]!.total).toBe(3);
    expect(messages[0]!.fileSize).toBe(10);
    expect(messages[0]!.index).toBe(0);
  });
});

describe('useChunkUpload · worker 模式', () => {
  it('按并发上限派发，收到 chunk-done 后补下一片', async () => {
    const worker = fakeWorker();
    const uploader = useChunkUpload({
      chunkSize: 5,
      concurrent: 2,
      createWorker: () => worker.worker,
    });

    const promise = uploader.uploadFile(fakeFile(15)); // 3 片
    await flush();

    // 并发 2：先派出 0、1，不会把 2 也提前发出去
    expect(worker.postMessage).toHaveLength(2);
    expect(uploader.chunks.value.filter((c) => c.status === 'uploading')).toHaveLength(2);

    worker.send({ type: 'chunk-done', index: 0, hash: 'h0' });
    await flush();
    expect(worker.postMessage).toHaveLength(3);
    expect(uploader.hash.value).toBe('h0');
    expect(uploader.progress.value).toBe(33);

    worker.send({ type: 'chunk-done', index: 1 });
    await flush();
    worker.send({ type: 'chunk-done', index: 2, hash: 'h2' });
    await expect(promise).resolves.toBeUndefined();

    expect(uploader.status.value).toBe('completed');
    expect(uploader.progress.value).toBe(100);
    expect(uploader.hash.value).toBe('h2');
  });

  it('progress 消息只更新对应分片', async () => {
    const worker = fakeWorker();
    const uploader = useChunkUpload({
      chunkSize: 5,
      concurrent: 1,
      createWorker: () => worker.worker,
    });

    void uploader.uploadFile(fakeFile(15));
    await flush();

    worker.send({ type: 'progress', index: 0, progress: 42 });
    expect(uploader.chunks.value[0]!.progress).toBe(42);
    // 越界索引不能把不存在的分片写出来
    worker.send({ type: 'progress', index: 99, progress: 80 });
    expect(uploader.chunks.value).toHaveLength(3);
  });

  it('worker 报 error 时整体失败，分片标 error', async () => {
    const worker = fakeWorker();
    const uploader = useChunkUpload({
      chunkSize: 5,
      concurrent: 1,
      createWorker: () => worker.worker,
    });

    const promise = uploader.uploadFile(fakeFile(10));
    await flush();

    worker.send({ type: 'error', index: 0, message: '哈希服务挂了' });
    await expect(promise).rejects.toThrow('哈希服务挂了');
    expect(uploader.status.value).toBe('error');
    expect(uploader.chunks.value[0]!.status).toBe('error');
  });

  it('worker 协议缺 message 时用索引兜底成错误信息', async () => {
    const worker = fakeWorker();
    const uploader = useChunkUpload({
      chunkSize: 5,
      concurrent: 1,
      createWorker: () => worker.worker,
    });

    const promise = uploader.uploadFile(fakeFile(5));
    await flush();
    worker.send({ index: 0, type: 'error' });

    await expect(promise).rejects.toThrow('chunk 0 failed');
  });

  it('pause 期间不再派发新分片，resume 后继续到完成', async () => {
    const worker = fakeWorker();
    const uploader = useChunkUpload({
      chunkSize: 5,
      concurrent: 1,
      createWorker: () => worker.worker,
    });

    const promise = uploader.uploadFile(fakeFile(15));
    await flush();
    expect(worker.postMessage).toHaveLength(1);

    uploader.pause();
    expect(uploader.status.value).toBe('paused');

    // 在途那片仍然会回包，但暂停期间不能派下一片
    worker.send({ type: 'chunk-done', index: 0 });
    await flush();
    expect(worker.postMessage).toHaveLength(1);

    uploader.resume();
    await flush();
    expect(worker.postMessage).toHaveLength(2);

    worker.send({ type: 'chunk-done', index: 1 });
    await flush();
    expect(worker.postMessage).toHaveLength(3);

    worker.send({ type: 'chunk-done', index: 2 });
    await expect(promise).resolves.toBeUndefined();
    expect(uploader.status.value).toBe('completed');
    expect(uploader.progress.value).toBe(100);
  });

  it('cancel 拒绝当前任务、terminate worker 并清空状态', async () => {
    const worker = fakeWorker();
    const uploader = useChunkUpload({
      chunkSize: 5,
      concurrent: 1,
      createWorker: () => worker.worker,
    });

    const promise = uploader.uploadFile(fakeFile(15));
    await flush();
    expect(uploader.uploading.value).toBe(true);

    uploader.cancel();
    await expect(promise).rejects.toThrow('cancelled');

    expect(uploader.status.value).toBe('idle');
    expect(uploader.progress.value).toBe(0);
    expect(uploader.chunks.value).toEqual([]);
    expect(worker.emitted()).toBe(1);
  });

  it('uploadFile 会先取消上一次未结束的任务', async () => {
    const worker = fakeWorker();
    const uploader = useChunkUpload({
      chunkSize: 5,
      concurrent: 1,
      createWorker: () => worker.worker,
    });

    const first = uploader.uploadFile(fakeFile(15));
    await flush();

    const second = uploader.uploadFile(fakeFile(5));
    await expect(first).rejects.toThrow('cancelled');

    await flush();
    worker.send({ type: 'chunk-done', index: 0 });
    await expect(second).resolves.toBeUndefined();
    expect(uploader.status.value).toBe('completed');
    // 第一次的 worker 被 terminate，第二次重新创建
    expect(worker.emitted()).toBeGreaterThanOrEqual(1);
  });

  it('未提供 worker 来源时不会构造任何 Worker', async () => {
    const ctor = vi.fn();
    vi.stubGlobal('Worker', ctor);

    const uploader = useChunkUpload({ chunkSize: 5 });
    await uploader.uploadFile(fakeFile(5));

    expect(ctor).not.toHaveBeenCalled();
    expect(uploader.status.value).toBe('completed');

    vi.unstubAllGlobals();
  });
});
