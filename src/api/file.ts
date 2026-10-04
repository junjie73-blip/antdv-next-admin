import type { FetchParams } from '~/components/business/Table'

import { request } from '~/composables'

import { post } from './request'
/* ============================================================
 * 上传任务管理
 * ============================================================ */

export type UploadTaskStatus = 'pending' | 'merging' | 'uploading' | 'failed'

export interface UploadTaskItem {
  taskId: string
  uploadId?: string
  fileName: string
  size: number
  mimeType?: string
  status: UploadTaskStatus
  progress?: number
  uploadedChunks?: number
  totalChunks?: number
  errorMsg?: string
  createdAt: string
  updatedAt?: string
  completedAt?: string
}
// ============================================================
// 文件管理
// ============================================================

export function getFileList(params?: FetchParams) {
  return request.get<{ list: any[]; total: number }>('/file/list', params)
}

export function deleteFile(id: string) {
  return post<void>(`/upload/delete`, { url: id })
}

// ============================================================
// 文件上传
// ============================================================

export function uploadFile(file: File) {
  const fd = new FormData()
  fd.append('file', file)
  // Content-Type 交给浏览器自动补 boundary，手写 multipart/form-data 会丢掉 boundary
  return request.post<any>('/upload/file', fd)
}

export function checkUploadedChunks(uploadId: string) {
  return request.get('/upload/check', { uploadId })
}

export function uploadChunk(data: FormData) {
  return request.post('/upload/chunk', data)
}

export function mergeChunks(data: Record<string, unknown>) {
  return request.post('/upload/merge', data)
}

export function deleteUploadedFile(url: string) {
  return request.post('/upload/delete', { url })
}
/** 查询上传任务列表 */
export function getUploadTaskList(params: any) {
  return request.get('/upload/tasks', params)
}

/** 取消上传任务（支持批量） */
export function cancelUploadTasks(taskIds: string[]) {
  return request.post('/upload/tasks/cancel', { taskIds })
}
// 文件预览
export function previewFile(params: any) {
  return request.get('/upload/preview', params)
}

// 文件下载
export function downloadFile(params: any) {
  return request.get('/upload/download', params)
}
