import { request } from '~/composables'

// ============================================================
// 权限管理
// 注意：permission 后端 status 是 string，不做 int 转换
// ============================================================

export function getPermissionList(params?: Record<string, any>) {
  return request.get('/permission/list', params)
}

export function getPermissionDetail(id: string) {
  return request.get(`/permission/${id}`)
}

export function createPermission(data: Record<string, any>) {
  return request.post('/permission', data)
}

export function updatePermission(id: string, data: Record<string, any>) {
  return request.put(`/permission/${id}`, data)
}

export function deletePermission(id: string) {
  return request.delete(`/permission/${id}`)
}
// 获取全部权限
export function getAllPermissions() {
  return request.get('/permission/all')
}
