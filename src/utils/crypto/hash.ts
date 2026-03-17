import SparkMD5 from 'spark-md5'

export function md5(data: string): string {
  return SparkMD5.hash(data)
}

export function md5File(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: globalThis.ArrayBuffer[] = []
    const reader = new FileReader()

    reader.onload = (e) => {
      if (e.target?.result) {
        chunks.push(e.target.result as globalThis.ArrayBuffer)
      }
    }

    reader.onloadend = () => {
      const spark = new SparkMD5()
      chunks.forEach(chunk => spark.append(chunk))
      resolve(spark.end())
    }

    reader.onerror = () => {
      reject(new Error('File read error'))
    }

    reader.readAsArrayBuffer(file)
  })
}

export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export function hash(data: string, options: { algorithm?: 'md5' | 'sha256' } = {}): string | Promise<string> {
  const { algorithm = 'md5' } = options
  return algorithm === 'md5' ? md5(data) : sha256(data)
}
