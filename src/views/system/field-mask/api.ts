import { request } from '~/composables'

/* ============================================================
 * 类型（对齐 OpenAPI FieldMaskCreate / FieldMaskUpdate）
 * ============================================================ */
export type MaskType = 'phone' | 'email' | 'idCard' | 'name' | 'custom'

export interface FieldMaskRecord {
  policyId: string
  name: string
  field: string
  maskType: MaskType
  pattern: string | null
  replaceChar: string
  keepPrefix: number
  keepSuffix: number
  description: string | null
  status: string
  createdAt: string
  updatedAt: string
}

export interface FieldMaskListParams {
  pageNum?: number
  pageSize?: number
  keyword?: string
  maskType?: MaskType
  status?: string
}

export interface FieldMaskCreateParams {
  name: string
  field: string
  maskType: MaskType
  pattern?: string
  replaceChar?: string
  keepPrefix?: number
  keepSuffix?: number
  description?: string
  status?: string
}

export type FieldMaskUpdateParams = Partial<FieldMaskCreateParams>

/* ============================================================
 * CRUD
 * ============================================================ */
export function getFieldMaskList(params: FieldMaskListParams) {
  return request.get<{ list: FieldMaskRecord[]; total: number }>('/field-mask/list', params)
}

export function getFieldMaskDetail(id: string) {
  return request.get<FieldMaskRecord>(`/field-mask/${id}`)
}

export function createFieldMask(data: FieldMaskCreateParams) {
  return request.post('/field-mask', data)
}

export function updateFieldMask(id: string, data: FieldMaskUpdateParams) {
  return request.put(`/field-mask/${id}`, data)
}

export function deleteFieldMask(id: string) {
  return request.delete(`/field-mask/${id}`)
}
