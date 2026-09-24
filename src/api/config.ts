import { http } from '~/utils'

// ============================================================
// 系统配置
// ============================================================

export function getSettingsList(params: any) {
  return http.Get('/config/list', { params }).send(true)
}

export function getSettingByKey(key: string) {
  return http.Get(`/config/value/${key}`)
}

export function addSetting(data: any) {
  return http.Post('/config', data)
}

export function updateSetting(id: string, data: any) {
  return http.Put(`/config/${id}`, data)
}

export function deleteSetting(id: string) {
  return http.Delete(`/config/${id}`)
}

export function batchDeleteSetting(ids: string[]) {
  return http.Post('/config/batch-delete', { ids })
}
