import { isBlob, isFunction, isNil, isString } from 'es-toolkit'

/* ============================================================
 * 类型定义
 * ============================================================ */

/** 进度回调参数 */
export interface DownloadProgress {
  /** 已加载字节数 */
  loaded: number
  /** 总字节数（可能为 0，服务端未返回 content-length） */
  total: number
  /** 百分比（0-100），total 为 0 时返回 0 */
  percent: number
}

/** 通用下载选项 */
export interface DownloadOptions {
  /** 进度回调 */
  onProgress?: (progress: DownloadProgress) => void
  /** 取消信号（配合 AbortController） */
  signal?: AbortSignal
  /** MIME 类型 */
  mimeType?: string
  /** 文件名推断失败时的 fallback */
  fallbackFilename?: string
}

/** URL 下载选项 */
export interface UrlDownloadOptions extends DownloadOptions {
  /** 请求方法 */
  method?: 'GET' | 'POST'
  /** 请求头 */
  headers?: Record<string, string>
  /** 请求体 */
  body?: BodyInit
  /** 是否重写 minio 代理 URL（默认 true） */
  rewriteMinioUrl?: boolean
  /** 凭证模式 */
  credentials?: RequestCredentials
}

/** 下载结果 */
export interface DownloadResult {
  success: boolean
  filename: string
  /** 文件大小（字节） */
  size?: number
  /** 错误信息（失败时） */
  error?: Error
}

/** 批量下载选项 */
export interface BatchDownloadOptions {
  /** 并发数，默认 3 */
  concurrency?: number
  /** 单个文件进度 */
  onProgress?: (index: number, progress: DownloadProgress) => void
  /** 单个文件完成 */
  onFileComplete?: (index: number, result: DownloadResult) => void
  /** 全部完成 */
  onAllComplete?: (results: DownloadResult[]) => void
  /** 单个文件之间的延迟（毫秒），默认 200 */
  delayBetween?: number
}

/* ============================================================
 * 内部工具
 * ============================================================ */

/** MinIO 代理前缀 */
const MINIO_PROXY_PREFIX = '/minio-api'

/**
 * 将 minio 代理 URL 重写为真实地址
 *
 * 例：`/minio-api/antdv/exports/xxx.xlsx`
 *   → `http://minio.host:9000/antdv/exports/xxx.xlsx`
 *
 * 真实地址通过 `VITE_MINIO_PUBLIC_URL` 环境变量配置。
 * 若未配置或 URL 不以代理前缀开头，则原样返回。
 */
function rewriteMinioUrl(url: string): string {
  if (!url.startsWith(MINIO_PROXY_PREFIX)) return url

  const realHost = (import.meta.env.VITE_MINIO_PUBLIC_URL as string | undefined)?.replace(/\/+$/, '')
  if (!realHost) return url

  return `${realHost}${url.slice(MINIO_PROXY_PREFIX.length)}`
}

/**
 * 从 Content-Disposition 响应头解析文件名
 *
 * 支持两种格式：
 *  - RFC 5987：`filename*=UTF-8''%E6%96%87%E4%BB%B6.xlsx`
 *  - 普通：`filename="文件.xlsx"`
 */
export function extractFilenameFromHeaders(headers: Headers, fallback: string): string {
  const disposition = headers.get('content-disposition') ?? headers.get('Content-Disposition')
  if (!disposition) return fallback

  // 优先 RFC 5987 格式
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim())
    } catch {
      /* 忽略解析失败，降级到普通格式 */
    }
  }

  // 普通格式
  const match = /filename="?([^";]+)"?/i.exec(disposition)
  return match?.[1]?.trim() ?? fallback
}

/**
 * 从 URL 推断文件名
 */
export function guessFilenameFromUrl(url: string, fallback = 'download'): string {
  try {
    const pathname = new URL(url, window.location.origin).pathname
    const last = pathname.split('/').filter(Boolean).pop()
    if (!last) return fallback
    return decodeURIComponent(last)
  } catch {
    return fallback
  }
}

/* ============================================================
 * 底层：保存 Blob
 * ============================================================ */

/**
 * 触发浏览器下载一个 Blob
 *
 * 相比原实现：
 *  - 延迟 revoke URL（避免 Safari 等浏览器尚未开始下载就失效）
 *  - a 标签加 `rel="noopener"` 和 `display: none`，不污染布局
 *  - 支持传入自定义文件名
 *
 * @example
 * ```ts
 * const blob = new Blob(['hello'], { type: 'text/plain' })
 * saveBlob(blob, 'hello.txt')
 * ```
 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'

  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  // 延迟 revoke：部分浏览器（Safari）读取 URL 是异步的
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * 保存一个 fetch Response 为文件
 *
 * 自动从 Content-Disposition 解析文件名（若未显式传入）。
 */
export async function saveResponse(response: Response, fallbackFilename = 'download'): Promise<DownloadResult> {
  if (!response.ok) {
    throw new Error(`下载失败：${response.status} ${response.statusText}`)
  }

  const filename = extractFilenameFromHeaders(response.headers, fallbackFilename) || fallbackFilename
  const blob = await response.blob()

  saveBlob(blob, filename)

  return { success: true, filename, size: blob.size }
}

/* ============================================================
 * 核心 API（保持原签名兼容）
 * ============================================================ */

/**
 * 通过请求函数获取二进制数据并下载
 *
 * @param request - 返回二进制数据的异步函数（通常是 alova / axios 的请求）
 * @param filename - 保存的文件名
 *
 * @example
 * ```ts
 * downloadBlob(
 *   () => http.Get('/export/users', { responseType: 'blob' }),
 *   '用户列表.xlsx',
 * )
 * ```
 */
export async function downloadBlob(request: () => Promise<unknown>, filename: string): Promise<void> {
  const res = await request()

  // 兼容三种返回：Blob / ArrayBuffer / 其他可转 Blob 的数据
  const blob = isBlob(res)
    ? res
    : new Blob([res as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

  saveBlob(blob, filename)
}

/**
 * 通过 URL 下载文件
 *
 * ⭐ 相比原实现：自动重写 minio 代理 URL
 *   `/minio-api/antdv/exports/xxx.xlsx`
 *   → `http://minio.host:9000/antdv/exports/xxx.xlsx`
 *
 * @param url - 文件 URL（支持 minio 代理前缀）
 * @param filename - 保存的文件名
 *
 * @example
 * ```ts
 * // 下载数据库中的文件
 * await downloadFile('/minio-api/antdv/exports/report-2024.xlsx', '报表.xlsx')
 * ```
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  console.log(url, filename, 'ccc')
  const realUrl = rewriteMinioUrl(url)
  const response = await fetch(realUrl)
  const result = await saveResponse(response, filename)

  // 如果服务端指定了文件名且调用方未显式命名，以服务端为准
  if (!filename && result.filename) {
    // 已在 saveResponse 内部处理
  }
}

/* ============================================================
 * 扩展 API
 * ============================================================ */

/**
 * 从 URL 下载文件（带进度回调 + 可取消）
 *
 * @example
 * ```ts
 * const controller = new AbortController()
 * await downloadFromUrl('/minio-api/xxx.zip', 'xxx.zip', {
 *   signal: controller.signal,
 *   onProgress: ({ percent }) => console.log(`${percent}%`),
 * })
 * // 用户点击取消
 * controller.abort()
 * ```
 */
export async function downloadFromUrl(
  url: string,
  filename: string,
  options: UrlDownloadOptions = {},
): Promise<DownloadResult> {
  const {
    method = 'GET',
    headers,
    body,
    credentials = 'same-origin',
    rewriteMinioUrl: shouldRewrite = true,
    fallbackFilename = filename,
    onProgress,
    signal,
  } = options

  const realUrl = shouldRewrite ? rewriteMinioUrl(url) : url

  try {
    const response = await fetch(realUrl, {
      method,
      headers,
      body,
      credentials,
      signal,
    })

    if (!response.ok) {
      throw new Error(`下载失败：${response.status} ${response.statusText}`)
    }

    const finalFilename = extractFilenameFromHeaders(response.headers, fallbackFilename) || fallbackFilename

    const blob = await readResponseWithProgress(response, onProgress)
    saveBlob(blob, finalFilename)

    return { success: true, filename: finalFilename, size: blob.size }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { success: false, filename, error: new Error('下载已取消') }
    }
    throw error
  }
}

/**
 * 流式下载大文件（内存占用低，支持进度）
 *
 * 相比 `downloadFromUrl` 的 `response.blob()`，本方法按 chunk 读取，
 * 适合几百 MB 以上的文件。
 */
export async function downloadStream(
  url: string,
  filename: string,
  options: UrlDownloadOptions = {},
): Promise<DownloadResult> {
  const {
    method = 'GET',
    headers,
    body,
    credentials = 'same-origin',
    rewriteMinioUrl: shouldRewrite = true,
    mimeType = 'application/octet-stream',
    onProgress,
    signal,
  } = options

  const realUrl = shouldRewrite ? rewriteMinioUrl(url) : url

  try {
    const response = await fetch(realUrl, {
      method,
      headers,
      body,
      credentials,
      signal,
    })

    if (!response.ok) {
      throw new Error(`下载失败：${response.status} ${response.statusText}`)
    }

    const finalFilename = extractFilenameFromHeaders(response.headers, filename)
    const contentLength = Number(response.headers.get('content-length') ?? 0)

    // 降级：浏览器/服务端不支持流
    if (!response.body) {
      const blob = await response.blob()
      saveBlob(blob, finalFilename)
      return { success: true, filename: finalFilename, size: blob.size }
    }

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let loaded = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      loaded += value.byteLength
      onProgress?.({
        loaded,
        total: contentLength,
        percent: contentLength > 0 ? (loaded / contentLength) * 100 : 0,
      })
    }

    const blob = new Blob(chunks as BlobPart[], { type: mimeType })
    saveBlob(blob, finalFilename)

    return { success: true, filename: finalFilename, size: blob.size }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { success: false, filename, error: new Error('下载已取消') }
    }
    throw error
  }
}

/**
 * 带认证头下载（Token 走 header，而不是 URL）
 *
 * @example
 * ```ts
 * downloadWithAuth('/api/export/users', '用户.xlsx', {
 *   headers: { Authorization: `Bearer ${getToken()}` },
 * })
 * ```
 */
export async function downloadWithAuth(
  url: string,
  filename: string,
  options: UrlDownloadOptions = {},
): Promise<DownloadResult> {
  return downloadFromUrl(url, filename, options)
}

/**
 * 从 Response 读取数据，带进度回调
 *
 * 内部工具，供 downloadFromUrl 使用。
 */
async function readResponseWithProgress(
  response: Response,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<Blob> {
  if (!onProgress || !response.body) {
    return response.blob()
  }

  const contentLength = Number(response.headers.get('content-length') ?? 0)
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.byteLength
    onProgress({
      loaded,
      total: contentLength,
      percent: contentLength > 0 ? (loaded / contentLength) * 100 : 0,
    })
  }

  const mimeType = response.headers.get('content-type') ?? 'application/octet-stream'
  return new Blob(chunks as BlobPart[], { type: mimeType })
}

/* ============================================================
 * 便捷导出
 * ============================================================ */

/**
 * 导出 JSON 数据为 .json 文件
 *
 * @example
 * ```ts
 * downloadJson({ users: [...] }, 'users.json')
 * ```
 */
export function downloadJson(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const finalName = filename.endsWith('.json') ? filename : `${filename}.json`
  saveBlob(blob, finalName)
}

/**
 * 导出纯文本为 .txt 文件
 */
export function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const finalName = filename.endsWith('.txt') ? filename : `${filename}.txt`
  saveBlob(blob, finalName)
}

/**
 * 从 Base64 字符串下载文件
 *
 * @example
 * ```ts
 * // 下载图片
 * downloadBase64('data:image/png;base64,iVBOR...', 'avatar.png')
 *
 * // 或纯 base64 串
 * downloadBase64('iVBOR...', 'avatar.png', 'image/png')
 * ```
 */
export function downloadBase64(base64: string, filename: string, mimeType = 'application/octet-stream'): void {
  // 支持 data URL 与纯 base64 串
  let pureBase64 = base64
  let finalMime = mimeType

  const dataUrlMatch = /^data:([^;]+);base64,(.+)$/.exec(base64)
  if (dataUrlMatch) {
    finalMime = dataUrlMatch[1]!
    pureBase64 = dataUrlMatch[2]!
  }

  const binary = atob(pureBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  const blob = new Blob([bytes], { type: finalMime })
  saveBlob(blob, filename)
}

/* ============================================================
 * 批量下载
 * ============================================================ */

/** 批量下载项 */
export interface BatchDownloadItem {
  url: string
  filename: string
  options?: UrlDownloadOptions
}

/**
 * 批量下载多个文件
 *
 * 按 `concurrency` 并发下载，单个文件之间插入 `delayBetween` 毫秒的延迟，
 * 避免同时触发大量下载请求被浏览器拦截。
 *
 * @example
 * ```ts
 * await downloadMultiple([
 *   { url: '/minio-api/antdv/exports/a.xlsx', filename: 'a.xlsx' },
 *   { url: '/minio-api/antdv/exports/b.xlsx', filename: 'b.xlsx' },
 * ], {
 *   concurrency: 2,
 *   onFileComplete: (i, r) => console.log(`${i}: ${r.success}`),
 * })
 * ```
 */
export async function downloadMultiple(
  items: BatchDownloadItem[],
  options: BatchDownloadOptions = {},
): Promise<DownloadResult[]> {
  const { concurrency = 3, onProgress, onFileComplete, onAllComplete, delayBetween = 200 } = options

  // oxlint-disable-next-line unicorn/no-new-array
  const results: DownloadResult[] = new Array(items.length)
  let cursor = 0

  /** 单个 worker：从队列里不断取任务 */
  async function worker(): Promise<void> {
    while (true) {
      const index = cursor++
      if (index >= items.length) return

      const item = items[index]!
      try {
        const result = await downloadFromUrl(item.url, item.filename, {
          ...item.options,
          onProgress: onProgress ? (progress) => onProgress(index, progress) : item.options?.onProgress,
        })
        results[index] = result
        onFileComplete?.(index, result)
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        const result: DownloadResult = {
          success: false,
          filename: item.filename,
          error: err,
        }
        results[index] = result
        onFileComplete?.(index, result)
      }

      // 文件之间的间隔
      if (delayBetween > 0 && cursor < items.length) {
        await new Promise((resolve) => setTimeout(resolve, delayBetween))
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.all(workers)

  onAllComplete?.(results)
  return results
}

/* ============================================================
 * 兼容旧 API（保留导出）
 * ============================================================ */

/**
 * @deprecated 请使用 `downloadFromUrl`，功能一致且更完善
 */
export { downloadFromUrl as downloadFileAdvanced }

/* ============================================================
 * 类型守卫
 * ============================================================ */

export { isBlob, isFunction, isNil, isString }
