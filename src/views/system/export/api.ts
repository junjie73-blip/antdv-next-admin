import { request } from '~/composables'

import type { ExportTask } from './types'

const BASE = '/system/export'

/** 支持的导出业务类型 */
export interface ExportTypeOption {
  bizType: string
  label: string
}

export interface SubmitExportPayload {
  bizType: string
  exportFormat?: 'xlsx' | 'csv' | 'json'
  queryParams?: Record<string, unknown>
  columns?: string[]
}

export const listExportTypes = () => request.get<ExportTypeOption[]>(`${BASE}/types`)

export const submitExport = (data: SubmitExportPayload) => request.post<{ taskId: string }>(`${BASE}/submit`, data)

export const listExports = (params: any) => request.get(`${BASE}/list`, params)

export const getExport = (id: string) => request.get<ExportTask>(`${BASE}/${id}`)

export const getExportDownloadUrl = (id: string) =>
  request.get<{ url: string; fileName: string }>(`${BASE}/${id}/download`)

export const cancelExport = (id: string) => request.post(`${BASE}/${id}/cancel`)

export const deleteExport = (id: string) => request.delete(`${BASE}/${id}`)
