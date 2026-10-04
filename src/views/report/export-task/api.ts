import { request } from '~/composables'

import type { ExportStats, ExportTaskRecord, ExportTrendItem } from './types'

export interface PageResult<T> {
  list: T[]
  total: number
}

export function getExportTaskList(params: {
  status?: string
  reportCode?: string
  keyword?: string
  pageNum?: number
  pageSize?: number
}) {
  return request.get<PageResult<ExportTaskRecord>>('/report/export-task/list', params)
}

export function getExportTaskDetail(id: string) {
  return request.get<ExportTaskRecord>(`/report/export-task/${id}`)
}

export function getExportTaskStats() {
  return request.get<any>('/report/export-task/stats')
}

export function getExportTaskTrend(days = 7) {
  return request.get<any>('/report/export-task/trend', { days })
}

export function cancelExportTask(id: string) {
  return request.post<void>(`/report/export-task/${id}/cancel`)
}

export function retryExportTask(id: string) {
  return request.post<void>(`/report/export-task/${id}/retry`)
}

export function deleteExportTask(id: string) {
  return request.delete<void>(`/report/export-task/${id}`)
}
