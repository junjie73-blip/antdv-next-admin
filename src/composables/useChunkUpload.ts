import { computed, ref, shallowRef } from 'vue'

export interface ChunkInfo {
  index: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  progress: number
}

export type UploadStatus = 'idle' | 'uploading' | 'paused' | 'completed' | 'error'

export interface ChunkUploadOptions {
  chunkSize?: number
  concurrent?: number
  workerUrl?: string
}

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024
const DEFAULT_CONCURRENT = 3

export function useChunkUpload(options: ChunkUploadOptions = {}) {
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    concurrent = DEFAULT_CONCURRENT,
    workerUrl,
  } = options

  const chunks = ref<ChunkInfo[]>([])
  const status = ref<UploadStatus>('idle')
  const progress = ref(0)
  const hash = ref('')

  const uploading = computed(() => status.value === 'uploading')

  const worker = shallowRef<Worker | null>(null)
  const pausedFlag = shallowRef(false)
  const cancelledFlag = shallowRef(false)
  const currentFile = shallowRef<File | null>(null)

  function getWorker(): Worker {
    if (!worker.value) {
      const url = workerUrl || new URL('@/workers/upload.worker.ts', import.meta.url).href
      worker.value = new Worker(url, { type: 'module' })
    }
    return worker.value
  }

  function resetState() {
    chunks.value = []
    progress.value = 0
    hash.value = ''
    pausedFlag.value = false
    cancelledFlag.value = false
    currentFile.value = null
  }

  function pause() {
    if (status.value === 'uploading') {
      pausedFlag.value = true
      status.value = 'paused'
    }
  }

  function resume() {
    if (status.value === 'paused' && currentFile.value) {
      pausedFlag.value = false
      status.value = 'uploading'
      processChunks(currentFile.value)
    }
  }

  function cancel() {
    cancelledFlag.value = true
    if (worker.value) {
      worker.value.terminate()
      worker.value = null
    }
    resetState()
    status.value = 'idle'
  }

  async function uploadFile(file: File): Promise<void> {
    cancel()

    currentFile.value = file
    status.value = 'uploading'

    const totalChunks = Math.ceil(file.size / chunkSize)
    chunks.value = Array.from({ length: totalChunks }, (_, i) => ({
      index: i,
      status: 'pending' as const,
      progress: 0,
    }))

    const w = getWorker()
    w.postMessage({ type: 'init', chunkSize, fileSize: file.size })

    await processChunks(file)
  }

  async function processChunks(file: File): Promise<void> {
    const totalChunks = chunks.value.length
    if (totalChunks === 0)
      return

    const w = getWorker()

    return new Promise<void>((resolve, reject) => {
      let currentIndex = 0
      let activeCount = 0
      let completedCount = 0
      let hasError = false

      w.onmessage = (e: MessageEvent) => {
        if (e.data.type === 'progress') {
          const { index, progress: chunkProgress } = e.data
          chunks.value[index].progress = chunkProgress
        }
        else if (e.data.type === 'complete') {
          hash.value = e.data.hash
        }
      }

      w.onerror = () => {
        hasError = true
        status.value = 'error'
        w.terminate()
        worker.value = null
        reject(new Error('Worker error'))
      }

      function submitNext() {
        if (cancelledFlag.value) {
          w.terminate()
          worker.value = null
          return
        }

        if (pausedFlag.value)
          return

        if (currentIndex >= totalChunks) {
          if (activeCount === 0) {
            status.value = 'completed'
            resolve()
          }
          return
        }

        const idx = currentIndex
        currentIndex++

        chunks.value[idx].status = 'uploading'
        activeCount++

        const start = idx * chunkSize
        const end = Math.min(start + chunkSize, file.size)
        const slice = file.slice(start, end)

        slice.arrayBuffer()
          .then((buffer) => {
            if (cancelledFlag.value || pausedFlag.value) {
              chunks.value[idx].status = 'pending'
              activeCount--
              checkDone()
              return
            }

            w.postMessage({
              type: 'process',
              chunk: buffer,
              index: idx,
              total: totalChunks,
            }, [buffer])

            chunks.value[idx].status = 'done'
            chunks.value[idx].progress = 100
            completedCount++
            progress.value = Math.round((completedCount / totalChunks) * 100)
            activeCount--

            checkDone()
          })
          .catch(() => {
            if (!cancelledFlag.value && !pausedFlag.value) {
              chunks.value[idx].status = 'error'
              hasError = true
              status.value = 'error'
            }
            activeCount--
            checkDone()
          })
      }

      function checkDone() {
        if (hasError) {
          status.value = 'error'
          return
        }
        if (cancelledFlag.value)
          return

        while (activeCount < concurrent && currentIndex < totalChunks) {
          if (pausedFlag.value)
            break
          submitNext()
        }

        if (completedCount >= totalChunks && activeCount === 0) {
          status.value = 'completed'
          resolve()
        }
      }

      for (let i = 0; i < concurrent && i < totalChunks; i++) {
        submitNext()
      }
    })
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
  }
}
