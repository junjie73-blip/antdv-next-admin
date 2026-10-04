import { request } from '~/composables'

import type { Overview, TopOperation, TrendData } from './types'

export interface QueryParams {
  startDate: string
  endDate: string
  operation?: string
}

export function getOverview(params: QueryParams) {
  return request.get<{ data: Overview }>('/monitor/audit-daily/overview', params)
}

export function getTrend(params: QueryParams) {
  return request.get<{ data: TrendData }>('/monitor/audit-daily/trend', params)
}

export function getTopOperations(params: QueryParams & { limit?: number }) {
  return request.get<{ data: TopOperation[] }>('/monitor/audit-daily/top-operations', params)
}

export function getOperationList() {
  return request.get<{ data: string[] }>('/monitor/audit-daily/operations')
}

export function triggerAggregate(data: { date?: string }) {
  return request.post('/monitor/audit-daily/aggregate', data)
}

export function triggerClean() {
  return request.post('/monitor/audit-daily/clean')
}
