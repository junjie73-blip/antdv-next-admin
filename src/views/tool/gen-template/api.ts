import { http } from '~/utils'

export type TemplateCategory = 'backend' | 'frontend' | 'sql'

export interface GenTemplateRecord {
  templateId: string
  templateKey: string
  templateName: string
  category: TemplateCategory
  currentVersion: number
  status: string
  createdAt: string
  updatedAt: string
}

export interface GenTemplateVersion {
  versionId: string
  version: number
  changelog: string | null
  isCurrent: number
  createdAt: string
  createdBy: string | null
}

export interface GenTemplateDetail extends GenTemplateRecord {
  versions: GenTemplateVersion[]
  currentContent: string | null
}

export interface GenTemplateListParams {
  pageNum?: number
  pageSize?: number
  keyword?: string
  category?: TemplateCategory
}

export interface GenTemplateCreateParams {
  templateKey: string
  templateName: string
  category: TemplateCategory
  content: string
  changelog?: string
}

export interface GenTemplateUpdateParams {
  templateName?: string
  content?: string
  changelog?: string
}

/* ============================================================
 * CRUD
 * ============================================================ */
export function getGenTemplateList(params: GenTemplateListParams) {
  return http.Get<{ list: GenTemplateRecord[]; total: number }>('/generator/template/list', {
    params,
  })
}

export function getGenTemplateDetail(id: string) {
  return http.Get<GenTemplateDetail>(`/generator/template/${id}`)
}

export function createGenTemplate(data: GenTemplateCreateParams) {
  return http.Post<{ templateId: string }>('/generator/template', data)
}

export function updateGenTemplate(id: string, data: GenTemplateUpdateParams) {
  return http.Put(`/generator/template/${id}`, data)
}

export function deleteGenTemplate(id: string) {
  return http.Delete(`/generator/template/${id}`)
}

export function rollbackGenTemplate(id: string, version: number) {
  return http.Post(`/generator/template/${id}/rollback`, { version })
}
