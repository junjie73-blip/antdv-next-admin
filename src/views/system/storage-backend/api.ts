import { request } from '~/composables'

export type BackendType = 'local' | 'minio' | 'oss' | 'cos' | 's3'

export interface StorageBackendRecord {
  backendId: string
  backendType: BackendType
  backendName: string
  config: Record<string, unknown>
  isActive: number
  isHealthy: number
  priority: number
  lastCheckAt: string | null
  lastCheckErr: string | null
  remark: string | null
  createdAt: string
  updatedAt: string
}

export interface StorageBackendListParams {
  pageNum?: number
  pageSize?: number
  backendType?: BackendType
  keyword?: string
}

export interface StorageBackendCreateParams {
  backendType: BackendType
  backendName: string
  config: Record<string, unknown>
  priority: number
  remark?: string
}

export type StorageBackendUpdateParams = Partial<Omit<StorageBackendCreateParams, 'backendType'>>

export function getStorageBackendList(params: StorageBackendListParams) {
  return request.get<{ list: StorageBackendRecord[]; total: number }>('/storage-backend/list', params)
}

export function getStorageBackendDetail(id: string) {
  return request.get<StorageBackendRecord>(`/storage-backend/${id}`)
}

export function createStorageBackend(data: StorageBackendCreateParams) {
  return request.post<{ backendId: string }>('/storage-backend', data)
}

export function updateStorageBackend(id: string, data: StorageBackendUpdateParams) {
  return request.put(`/storage-backend/${id}`, data)
}

export function deleteStorageBackend(id: string) {
  return request.delete(`/storage-backend/${id}`)
}

export function activateStorageBackend(backendId: string) {
  return request.post('/storage-backend/activate', { backendId })
}

export function checkStorageBackend(id: string) {
  return request.post(`/storage-backend/${id}/check`)
}
