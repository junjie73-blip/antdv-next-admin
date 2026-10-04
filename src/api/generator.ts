import type {
  GenTable,
  GenTableCreateParams,
  GenTableListParams,
  GenTableUpdateParams,
  TemplateKey,
} from '~/views/tool/code/types'

import { request } from '~/composables'

/** 列表 */
export function getGenTableList(params: GenTableListParams) {
  return request.get<{ list: GenTable[]; total: number }>('/generator/list', params)
}

/** 详情（含字段） */
export function getGenTableDetail(id: string) {
  return request.get<GenTable>(`/generator/${id}`)
}

/** 新增（建表 + 存元数据） */
export function createGenTable(data: GenTableCreateParams) {
  return request.post<{ tableId: string; tableName: string }>('/generator', data)
}

/** 更新元数据 */
export function updateGenTable(id: string, data: GenTableUpdateParams) {
  return request.put(`/generator/${id}`, data)
}

/** 删除配置 */
export function deleteGenTable(id: string) {
  return request.delete(`/generator/${id}`)
}

/** 预览单个模板 */
export function previewGenCode(id: string, template: TemplateKey) {
  return request.get<{ code: string }>(`/generator/${id}/preview/${template}`)
}

/**
 * 下载 zip
 *
 * ⚠️ 运行时实际返回 Blob（responseType: 'blob'）。返回类型沿用历史声明，
 * 避免牵动既有调用点 window.open(...)，调用方应按 Blob 处理。
 */
export function getGenCodeDownloadUrl(id: string): Promise<string> {
  return request.get<string>(`/generator/${id}/download`, undefined, { responseType: 'blob' })
}
