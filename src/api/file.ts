import type { FetchParams } from '~/components/business/Table'

import { http } from '~/utils'

import { del, get, post } from './request'
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
  return http.Get<{ list: any[]; total: number }>('/file/list', { params }).send(true)
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
  return http.Post<any>('/upload/file', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export function checkUploadedChunks(uploadId: string) {
  return http.Get('/upload/check', { params: { uploadId } })
}

export function uploadChunk(data: FormData) {
  return http.Post('/upload/chunk', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export function mergeChunks(data: Record<string, unknown>) {
  return http.Post('/upload/merge', data)
}

export function deleteUploadedFile(url: string) {
  return http.Post('/upload/delete', { url })
}
/** 查询上传任务列表 */
export function getUploadTaskList(params: any) {
  return http.Get('/upload/tasks', { params }).send(true)
}

/** 取消上传任务（支持批量） */
export function cancelUploadTasks(taskIds: string[]) {
  return http.Post('/upload/tasks/cancel', { taskIds })
}
// 文件预览
export function previewFile(params: any) {
  return http.Get('/upload/preview', { params }).send(true)
}

// 文件下载
export function downloadFile(params: any) {
  return http.Get('/upload/download', { params }).send(true)
}
