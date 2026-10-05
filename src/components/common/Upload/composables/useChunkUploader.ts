import { delay } from 'es-toolkit'
import { ref, type Ref } from 'vue'

import type { ChunkUploadTask, UploadStatus } from '../types'

import { checkChunks, checkInstant, getMergeStatus, mergeChunks, uploadChunk as uploadChunkApi } from '../api'
import {
  CHUNK_SIZE_MAX,
  CHUNK_SIZE_MIN,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_CONCURRENCY,
  DEFAULT_MAX_RETRY,
  SPEED_WINDOW_MS,
  classifyUploadError,
} from '../constants'
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
} from '../utils'
import { createBandwidthLimiter } from './useBandwidth'
import { computeFileHash } from './useHashWorker'

interface UseChunkUploaderOptions {
  chunkSize?: number
  concurrency?: number
  maxRetry?: number
  onUpdate?: (task: ChunkUploadTask) => void
  onMergeStart?: (task: ChunkUploadTask) => void
  onSuccess?: (task: ChunkUploadTask) => void
  onError?: (task: ChunkUploadTask, info: { code: string; message: string; retryable: boolean }) => void
  bandwidth?: number
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
  } = options
  const limiter = createBandwidthLimiter(options.bandwidth ?? 0)
  const tasks = ref(new Map<string, ChunkUploadTask>())
  const aborters = new Map<string, AbortController>()
  const speedWindow = new Map<string, Array<{ t: number; loaded: number }>>()

  function notify(task: ChunkUploadTask): void {
    onUpdate?.(task)
  }

  function setStatus(task: ChunkUploadTask, status: UploadStatus, error?: string): void {
    task.status = status
    if (error !== undefined) task.error = error
    tasks.value.set(task.uid, task)
    notify(task)
  }

  function updateSpeed(task: ChunkUploadTask): void {
    const now = Date.now()
    const win = speedWindow.get(task.uid) ?? []
    win.push({ t: now, loaded: task.loaded })
    while (win.length > 0 && now - win[0]!.t > SPEED_WINDOW_MS) win.shift()
    speedWindow.set(task.uid, win)

    if (win.length >= 2) {
      const first = win[0]!
      const last = win[win.length - 1]!
      const dt = (last.t - first.t) / 1000
      const dl = last.loaded - first.loaded
      task.speed = dt > 0 ? dl / dt : 0
      task.remaining = task.speed > 0 ? (task.total - task.loaded) / task.speed : 0
    } else {
      task.speed = 0
      task.remaining = 0
    }
  }

  function computeHash(task: ChunkUploadTask, signal: AbortSignal): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const hashTask = computeFileHash(
        { file: task.file, chunkSize: task.chunkSize },
        {
          onProgress: (_r, _t, percent) => {
            task.hashProgress = percent
            notify(task)
          },
          onComplete: (hash) => {
            task.hashProgress = 100
            resolve(hash)
          },
          onError: (msg) => reject(new Error(msg)),
        },
      )

      signal.addEventListener(
        'abort',
        () => {
          hashTask.cancel()
          reject(new DOMException('Aborted', 'AbortError'))
        },
        { once: true },
      )

      hashTask.promise.catch(() => {})
    })
  }

  async function uploadChunkWithRetry(
    task: ChunkUploadTask,
    chunk: Blob,
    index: number,
    signal: AbortSignal,
  ): Promise<void> {
    let attempt = 0

    while (attempt <= maxRetry) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')

      try {
        await limiter.record(chunk.size)
        await uploadChunkApi({
          uploadId: task.uploadId!,
          index,
          total: task.totalChunks,
          chunk,
          filename: task.filename,
        })

        task.uploadedChunks.add(index)
        task.loaded += chunk.size
        updateSpeed(task)
        saveResume(task.hash!, task.filename, task.size, task.uploadedChunks)
        notify(task)
        return
      } catch (err) {
        const info = classifyUploadError(err)
        if (info.code === 'ABORTED') throw err

        attempt++

        // 不可重试 → 立即失败
        if (!info.retryable) {
          const e = new Error(info.message)
          ;(e as any).code = info.code
          throw e
        }

        if (attempt > maxRetry) {
          const e = new Error(`分片 ${index} 重试 ${maxRetry} 次后失败：${info.message}`)
          ;(e as any).code = info.code
          throw e
        }

        task.retryCount++
        task.lastRetryAt = Date.now()
        notify(task)

        const delay = info.retryDelayMs ?? backoffDelay(attempt)
        await sleep(delay * 1000)
      }
    }
  }

  async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
    let cursor = 0
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const idx = cursor++
        await worker(items[idx]!)
      }
    })
    await Promise.all(runners)
  }

  async function startTask(task: ChunkUploadTask): Promise<void> {
    if (task.status === 'uploading' || task.status === 'hashing' || task.status === 'merging') {
      return
    }

    const aborter = new AbortController()
    aborters.set(task.uid, aborter)

    try {
      /* ---------- 1. hash ---------- */
      if (!task.hash) {
        setStatus(task, 'hashing')
        task.hashProgress = 0
        task.hash = await computeHash(task, aborter.signal)
      }

      if (!task.uploadId) {
        task.uploadId = hashToUuid(task.hash)
      }

      /* ---------- 2. 检查已上传分片 ---------- */
      setStatus(task, 'uploading')
      const instant = await checkInstant({
        fileHash: task.hash,
        fileSize: task.size,
        filename: task.filename,
      })
      if (instant.hit) {
        task.fileId = instant.fileId
        task.result = {
          fileId: instant.fileId,
          url: instant.url,
          size: instant.size,
          filename: instant.filename,
        }
        task.loaded = task.total
        setStatus(task, 'success')
        onSuccess?.(task)
        return
      }
      const chunkBlobs = sliceFile(task.file, task.chunkSize)
      task.totalChunks = chunkBlobs.length

      const checkData = await checkChunks(
        task.uploadId,
        task.filename,
        task.size,
        task.totalChunks, // ⭐ 传 totalChunks 让服务端限制查询
      )
      const remoteUploaded = new Set(checkData.uploadedChunks ?? [])

      // 秒传：所有分片都在
      if (task.totalChunks > 0 && remoteUploaded.size >= task.totalChunks) {
        task.loaded = task.total
        task.uploadedChunks = new Set(Array.from({ length: task.totalChunks }, (_, i) => i))
        setStatus(task, 'merging')
        task.mergeStartedAt = Date.now()

        // 直接合并（缺本地分片，走远程合并）
        await doMerge(task)
        return
      }

      /* ---------- 3. 合并本地 + 远端 ---------- */
      const localUploaded = loadResume(task.hash!) ?? new Set<number>()
      const merged = new Set<number>([...remoteUploaded, ...localUploaded])
      task.uploadedChunks = merged

      task.loaded = 0
      for (const i of merged) {
        const blob = chunkBlobs[i]
        if (blob) task.loaded += blob.size
      }
      notify(task)

      /* ---------- 4. 并发上传剩余分片 ---------- */
      const pending: Array<{ index: number; blob: Blob }> = []
      for (let i = 0; i < chunkBlobs.length; i++) {
        if (!merged.has(i)) pending.push({ index: i, blob: chunkBlobs[i]! })
      }

      await runWithConcurrency(pending, concurrency, async ({ index, blob }) => {
        if (aborter.signal.aborted) {
          throw new DOMException('Aborted', 'AbortError')
        }
        await uploadChunkWithRetry(task, blob, index, aborter.signal)
      })

      /* ---------- 5. 合并 ---------- */
      await doMerge(task)
    } catch (err) {
      const info = classifyUploadError(err)
      if (info.code === 'ABORTED') {
        setStatus(task, 'paused')
      } else {
        task.errorCode = info.code as any
        task.errorRetryable = info.retryable
        setStatus(task, 'error', info.message)
        onError?.(task, info)
      }
    } finally {
      aborters.delete(task.uid)
      speedWindow.delete(task.uid)
    }
  }

  async function doMerge(task: ChunkUploadTask): Promise<void> {
    setStatus(task, 'merging')
    task.mergeStartedAt = Date.now()

    const mergeResult = await mergeChunks({
      uploadId: task.uploadId!,
      filename: task.filename,
      size: task.size,
      totalChunks: task.totalChunks,
      mimeType: task.mimeType,
      fileHash: task.hash!,
    })

    task.taskId = mergeResult.taskId
    task.mergeStatus = mergeResult.status

    clearResume(task.hash!)
    task.uploadedChunks.clear()
    task.loaded = task.total
    task.retryCount = 0
    notify(task)

    onMergeStart?.(task)

    if (mergeResult.status === 'completed') {
      task.mergeStatus = 'completed'
      setStatus(task, 'success')
      onSuccess?.(task)
      return
    }

    // ⭐ 轮询（10 分钟超时）
    await pollMergeStatus(task)
  }
  async function pollMergeStatus(task: ChunkUploadTask): Promise<void> {
    const MAX_WAIT_MS = 10 * 60 * 1000
    const INTERVAL_MS = 2000
    const startedAt = Date.now()
    let consecutiveErrors = 0

    while (Date.now() - startedAt < MAX_WAIT_MS) {
      await sleep(INTERVAL_MS)
      if (task.status === 'canceled') return
      await delay(2000 * consecutiveErrors)

      try {
        const res = await getMergeStatus(task.taskId!)
        consecutiveErrors++

        task.mergeStatus = res.status as any
        notify(task)

        if (res.status === 'completed') {
          task.result = {
            fileId: res.fileId ?? undefined,
            url: res.url ?? undefined,
            size: res.size ?? undefined,
            filename: task.filename,
          }
          setStatus(task, 'success')
          onSuccess?.(task)
          return
        }

        if (res.status === 'failed') {
          throw new Error(res.errorMsg ?? '合并失败')
        }
      } catch (err) {
        consecutiveErrors++
        if (consecutiveErrors >= 5) {
          throw new Error(`查询合并状态失败：${(err as Error).message}`)
        }
      }
    }

    throw new Error('合并超时（10 分钟），请刷新页面查看结果')
  }
  /* ============================================================
   * 对外 API
   * ============================================================ */

  function addFiles(files: File[]): ChunkUploadTask[] {
    const created: ChunkUploadTask[] = []
    for (const file of files) {
      const effectiveChunkSize = resolveChunkSize(file.size)
      const totalChunks = Math.ceil(file.size / effectiveChunkSize)
      const task: ChunkUploadTask = {
        uid: genUid(),
        file,
        filename: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        status: 'waiting',
        loaded: 0,
        total: file.size,
        chunkSize: effectiveChunkSize,
        totalChunks,
        uploadedChunks: new Set(),
        speed: 0,
        remaining: 0,
        retryCount: 0,
        hashProgress: 0,
      }
      tasks.value.set(task.uid, task)
      created.push(task)
      notify(task)
    }
    return created
  }

  function start(uid?: string): void {
    if (uid) {
      const t = tasks.value.get(uid)
      if (t) void startTask(t)
      return
    }
    tasks.value.forEach((t) => {
      if (t.status === 'waiting') void startTask(t)
    })
  }

  function pause(uid?: string): void {
    const targets = uid
      ? ([tasks.value.get(uid)].filter(Boolean) as ChunkUploadTask[])
      : Array.from(tasks.value.values())
    for (const t of targets) {
      if (t.status === 'uploading' || t.status === 'hashing' || t.status === 'merging') {
        aborters.get(t.uid)?.abort()
      }
    }
  }

  function resume(uid?: string): void {
    const targets = uid
      ? ([tasks.value.get(uid)].filter(Boolean) as ChunkUploadTask[])
      : Array.from(tasks.value.values())
    for (const t of targets) {
      if (t.status === 'paused' || t.status === 'error') void startTask(t)
    }
  }

  function cancel(uid?: string): void {
    const targets = uid
      ? ([tasks.value.get(uid)].filter(Boolean) as ChunkUploadTask[])
      : Array.from(tasks.value.values())
    for (const t of targets) {
      aborters.get(t.uid)?.abort()
      setStatus(t, 'canceled')
      if (t.hash) clearResume(t.hash)
    }
  }

  function remove(uid: string): void {
    cancel(uid)
    tasks.value.delete(uid)
  }

  function retry(uid: string): void {
    const t = tasks.value.get(uid)
    if (t && t.status === 'error') {
      // 重置错误状态
      t.error = undefined
      t.errorCode = undefined
      t.errorRetryable = undefined
      void startTask(t)
    }
  }

  function clear(): void {
    cancel()
    tasks.value.clear()
  }

  function getTasks(): ChunkUploadTask[] {
    return Array.from(tasks.value.values())
  }

  function resolveChunkSize(fileSize: number): number {
    if (chunkSize && chunkSize > 0) {
      return Math.min(CHUNK_SIZE_MAX, Math.max(CHUNK_SIZE_MIN, chunkSize))
    }
    return calcChunkSize(fileSize)
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
    setBandwidth: (bps: number) => limiter.setLimit(bps),
    getBandwidth: () => limiter.bytesPerSecond,
  }
}

export type UseChunkUploaderReturn = ReturnType<typeof useChunkUploader>
