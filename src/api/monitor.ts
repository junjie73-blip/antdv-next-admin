import { http } from '~/utils'

// ============================================================
// 服务监控
// ============================================================

export function getServerInfo() {
  return http.Get('/monitor/server/info')
}
export function getServerSnapshot() {
  return http.Get('/monitor/server/snapshot').send(true)
}
