import UploadWorker from '../upload.worker?worker'

interface HashWorkerCallbacks {
  onProgress?: (received: number, total: number, percent: number, mimeType?: string) => void
  onComplete?: (hash: string) => void
  onError?: (message: string) => void
}

interface HashTaskOptions {
  file: File
  chunkSize: number
}

export interface HashTask {
  cancel: () => void
  promise: Promise<string>
}

export function computeFileHash(options: HashTaskOptions, callbacks?: HashWorkerCallbacks): HashTask {
  const { file, chunkSize } = options

  const worker = new UploadWorker()
  const totalChunks = Math.ceil(file.size / chunkSize)

  let canceled = false
  let resolveFn: (hash: string) => void
  let rejectFn: (err: Error) => void

  const promise = new Promise<string>((resolve, reject) => {
    resolveFn = resolve
    rejectFn = reject
  })

  worker.onmessage = (e: MessageEvent) => {
    const msg = e.data as
      | { type: 'ready' }
      | { type: 'progress'; received: number; total: number; percent: number; mimeType?: string }
      | { type: 'complete'; hash: string }
      | { type: 'error'; message: string }
      | { type: 'canceled' }

    switch (msg.type) {
      case 'ready':
        void feedChunks()
        break
      case 'progress':
        callbacks?.onProgress?.(msg.received, msg.total, msg.percent, msg.mimeType)
        break
      case 'complete':
        cleanup()
        callbacks?.onComplete?.(msg.hash)
        resolveFn(msg.hash)
        break
      case 'error':
        cleanup()
        callbacks?.onError?.(msg.message)
        rejectFn(new Error(msg.message))
        break
      case 'canceled':
        cleanup()
        rejectFn(new Error('已取消'))
        break
    }
  }

  worker.onerror = (err) => {
    cleanup()
    rejectFn(new Error(err.message || 'Worker 异常'))
  }

  async function feedChunks(): Promise<void> {
    try {
      for (let i = 0; i < totalChunks; i++) {
        if (canceled) return

        const start = i * chunkSize
        const end = Math.min(start + chunkSize, file.size)
        const blob = file.slice(start, end)
        const buffer = await blob.arrayBuffer()

        if (canceled) return
        worker.postMessage({ type: 'chunk', index: i, buffer }, [buffer])
      }
    } catch (err) {
      cleanup()
      rejectFn(err instanceof Error ? err : new Error(String(err)))
    }
  }

  function cleanup(): void {
    try {
      worker.terminate()
    } catch {
      /* ignore */
    }
  }

  worker.postMessage({
    type: 'init',
    fileName: file.name,
    fileSize: file.size,
    totalChunks,
  })

  function cancel(): void {
    if (canceled) return
    canceled = true
    try {
      worker.postMessage({ type: 'cancel' })
      worker.terminate()
    } catch {
      /* ignore */
    }
    rejectFn(new Error('已取消'))
  }

  return { cancel, promise }
}
