import { request } from '~/composables'

// ============================================================
// 服务监控
// ============================================================

export function getServerInfo() {
  return request.get('/monitor/server/info')
}
export function getServerSnapshot() {
  return request.get('/monitor/server/snapshot')
}
