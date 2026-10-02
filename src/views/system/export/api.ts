import { http } from '~/utils'

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

export const listExportTypes = () => http.Get<ExportTypeOption[]>(`${BASE}/types`)

export const submitExport = (data: SubmitExportPayload) => http.Post<{ taskId: string }>(`${BASE}/submit`, data)

export const listExports = (params: any) => http.Get(`${BASE}/list`, params).send(true)

export const getExport = (id: string) => http.Get<ExportTask>(`${BASE}/${id}`)

export const getExportDownloadUrl = (id: string) =>
  http.Get<{ url: string; fileName: string }>(`${BASE}/${id}/download`).send(true)

export const cancelExport = (id: string) => http.Post(`${BASE}/${id}/cancel`).send(true)

export const deleteExport = (id: string) => http.Delete(`${BASE}/${id}`).send(true)
