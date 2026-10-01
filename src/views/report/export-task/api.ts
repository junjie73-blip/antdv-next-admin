import { http } from '~/utils'

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
  return http.Get<PageResult<ExportTaskRecord>>('/report/export-task/list', {
    params,
  })
}

export function getExportTaskDetail(id: string) {
  return http.Get<ExportTaskRecord>(`/report/export-task/${id}`)
}

export function getExportTaskStats() {
  return http.Get<any>('/report/export-task/stats')
}

export function getExportTaskTrend(days = 7) {
  return http.Get<any>('/report/export-task/trend', {
    params: { days },
  })
}

export function cancelExportTask(id: string) {
  return http.Post<void>(`/report/export-task/${id}/cancel`)
}

export function retryExportTask(id: string) {
  return http.Post<void>(`/report/export-task/${id}/retry`)
}

export function deleteExportTask(id: string) {
  return http.Delete<void>(`/report/export-task/${id}`)
}
