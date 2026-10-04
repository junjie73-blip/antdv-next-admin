import { request } from '~/composables'

interface PageResult<T> {
  list: T[]
  total: number
}

export type ExportType = 'excel' | 'pdf' | 'html' | 'csv'

/* ============ 报表 ============ */
export function getReportList(params: { keyword?: string; category?: string; pageNum?: number; pageSize?: number }) {
  return request.get<any>('/report/list', params)
}

export function getReportDetail(idOrCode: string) {
  return request.get<any>(`/report/${idOrCode}`)
}

export function executeReport(code: string, params: Record<string, any>) {
  return request.post<any>(`/report/${code}/execute`, { params, useCache: true })
}

export function exportReport(code: string, type: ExportType, params: Record<string, any>, isAsync = false) {
  return request.post<any>(`/report/${code}/export/${type}`, {
    params,
    async: isAsync,
  })
}

export function toggleReportFavorite(id: string) {
  return request.post<{ isFavorite: boolean }>(`/report/${id}/favorite`)
}

/* ============ 数据集 ============ */
export function getDatasetList(params: { keyword?: string; category?: string; pageNum?: number; pageSize?: number }) {
  return request.get<PageResult<any>>('/report/dataset/list', params)
}

export function getDatasetDetail(id: string) {
  return request.get<any>(`/report/dataset/${id}`)
}

export function createDataset(data: any) {
  return request.post<any>('/report/dataset', data)
}

export function updateDataset(id: string, data: any) {
  return request.post<any>(`/report/dataset/${id}`, data)
}

export function deleteDataset(id: string) {
  return request.delete<void>(`/report/dataset/${id}`)
}

export function testDataset(id: string, data: { params: Record<string, any>; limit?: number }) {
  return request.post<{
    rows: any[]
    rowCount: number
    duration: number
    fields: Array<{ name: string; type: string; label?: string }>
    resolvedParams: Record<string, any>
  }>(`/report/dataset/${id}/test`, data)
}

/* ============ 导出任务 ============ */
export function getExportTaskList(params: { status?: string; pageNum?: number; pageSize?: number }) {
  return request.get<PageResult<any>>('/report/export-task/list', params)
}

export function cancelExportTask(id: string) {
  return request.post<void>(`/report/export-task/${id}/cancel`)
}

export function retryExportTask(id: string) {
  return request.post<void>(`/report/export-task/${id}/retry`)
}
