import type {
  GenTable,
  GenTableCreateParams,
  GenTableListParams,
  GenTableUpdateParams,
  TemplateKey,
} from '~/views/tool/code/types'

import { http } from '~/utils'

/** 列表 */
export function getGenTableList(params: GenTableListParams) {
  return http.Get<{ list: GenTable[]; total: number }>('/generator/list', { params })
}

/** 详情（含字段） */
export function getGenTableDetail(id: string) {
  return http.Get<GenTable>(`/generator/${id}`)
}

/** 新增（建表 + 存元数据） */
export function createGenTable(data: GenTableCreateParams) {
  return http.Post<{ tableId: string; tableName: string }>('/generator', data)
}

/** 更新元数据 */
export function updateGenTable(id: string, data: GenTableUpdateParams) {
  return http.Put(`/generator/${id}`, data)
}

/** 删除配置 */
export function deleteGenTable(id: string) {
  return http.Delete(`/generator/${id}`)
}

/** 预览单个模板 */
export function previewGenCode(id: string, template: TemplateKey) {
  return http.Get<{ code: string }>(`/generator/${id}/preview/${template}`).send(true)
}

/** 下载 zip（返回 URL，交给 window.open） */
export function getGenCodeDownloadUrl(id: string): Promise<string> {
  return http
    .Get<string>(`/generator/${id}/download`, {
      meta: { responseType: 'blob' },
    })
    .send(true)
}
