interface ProcessMessage {
  type: 'process'
  chunk: ArrayBuffer
  index: number
  total: number
}

interface InitMessage {
  type: 'init'
  chunkSize: number
  fileSize: number
}

type WorkerMessage = ProcessMessage | InitMessage

let globalFileSize = 0
let chunks: ArrayBuffer[] = []

async function computeHash(buffers: ArrayBuffer[]): Promise<string> {
  const totalLength = buffers.reduce((acc, buf) => acc + buf.byteLength, 0)
  const merged = new Uint8Array(totalLength)
  let offset = 0
  for (const buf of buffers) {
    merged.set(new Uint8Array(buf), offset)
    offset += buf.byteLength
  }

  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', merged)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  } catch {
    let hash = 0
    for (let i = 0; i < merged.length; i++) {
      hash = ((hash << 5) - hash + merged[i]) | 0
    }
    return Math.abs(hash).toString(16).padStart(8, '0')
  }
}

function simulateProcess(duration: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, duration))
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { type } = e.data

  if (type === 'init') {
    globalFileSize = e.data.fileSize
    chunks = []
    self.postMessage({ type: 'ready' })
    return
  }

  if (type === 'process') {
    const { chunk, index, total } = e.data
    chunks[index] = chunk

    const progress = (index + 1) / total
    self.postMessage({
      type: 'progress',
      index,
      progress: Math.round(progress * 100),
    })

    await simulateProcess(50 + Math.random() * 100)
  }

  if (type === 'process' && e.data.index === e.data.total - 1) {
    const hash = await computeHash(chunks)
    self.postMessage({ type: 'complete', hash })
  }
}