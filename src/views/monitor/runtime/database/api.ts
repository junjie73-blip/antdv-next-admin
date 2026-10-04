import { request } from '~/composables'

export function getDbInfo() {
  return request.get('/monitor/database/info')
}
export function getSlowQueries(limit = 20) {
  return request.get('/monitor/database/slow-queries', { limit })
}
export function getTableStats(limit = 30) {
  return request.get('/monitor/database/tables', { limit })
}
export function getIndexStats(limit = 20) {
  return request.get('/monitor/database/indexes', { limit })
}
export function getBloatTables() {
  return request.get('/monitor/database/bloat')
}
