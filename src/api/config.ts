import { request } from '~/composables'

// ============================================================
// 系统配置
// ============================================================

export function getSettingsList(params: any) {
  return request.get('/config/list', params)
}

export function getSettingByKey(key: string) {
  return request.get(`/config/value/${key}`)
}

export function addSetting(data: any) {
  return request.post('/config', data)
}

export function updateSetting(id: string, data: any) {
  return request.put(`/config/${id}`, data)
}

export function deleteSetting(id: string) {
  return request.delete(`/config/${id}`)
}

export function batchDeleteSetting(ids: string[]) {
  return request.post('/config/batch-delete', { ids })
}
