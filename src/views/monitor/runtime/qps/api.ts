import { request } from '~/composables'

export function getQpsSummary(windowSeconds = 300) {
  return request.get('/monitor/qps/summary', { windowSeconds })
}
export function getQpsHistory(minutes = 5) {
  return request.get('/monitor/qps/history', { minutes })
}
