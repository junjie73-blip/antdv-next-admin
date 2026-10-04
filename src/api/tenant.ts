import { request } from '~/composables'

import { get } from './request'

// ============================================================
// 租户管理
// ============================================================

export function getTenantList(params: any) {
  return request.get('/tenant/list', params)
}

export function getTenantDetail(id: string) {
  return request.get(`/tenant/${id}`)
}

/** 租户下拉选项 */
export function getTenantOptions() {
  return get<{ tenantId: string; tenantCode: string; tenantName: string }[]>('/tenant/options')
}

export function createTenant(data: any) {
  return request.post('/tenant/save', data)
}

export function updateTenant(id: string, data: any) {
  return request.post(`/tenant/update/${id}`, data)
}

export function deleteTenant(id: string) {
  return request.get(`/tenant/remove/${id}`)
}

export function batchDeleteTenant(ids: string[]) {
  return request.post('/tenant/batch-delete', { ids })
}

export function exportTenants(params?: Record<string, unknown>) {
  return request.get('/tenant/export', params)
}
