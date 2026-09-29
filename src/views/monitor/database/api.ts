import { http } from '~/utils'

export function getDbInfo() {
  return http.Get('/monitor/database/info').send(true)
}
export function getSlowQueries(limit = 20) {
  return http.Get('/monitor/database/slow-queries', { params: { limit } }).send(true)
}
export function getTableStats(limit = 30) {
  return http.Get('/monitor/database/tables', { params: { limit } }).send(true)
}
export function getIndexStats(limit = 20) {
  return http.Get('/monitor/database/indexes', { params: { limit } }).send(true)
}
export function getBloatTables() {
  return http.Get('/monitor/database/bloat').send(true)
}
