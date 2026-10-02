import { http } from '~/utils'

export function getQpsSummary(windowSeconds = 300) {
  return http.Get('/monitor/qps/summary', { params: { windowSeconds } }).send(true)
}
export function getQpsHistory(minutes = 5) {
  return http.Get('/monitor/qps/history', { params: { minutes } }).send(true)
}
