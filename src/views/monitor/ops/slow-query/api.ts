import { request } from '~/composables'

export type SlowQueryStatus = 'open' | 'resolved' | 'ignored'

export interface SlowQueryRecord {
  id: string
  tenantId: string | null
  fingerprint: string
  querySample: string
  queryHash: string
  calls: number
  totalTimeMs: number
  meanTimeMs: number
  maxTimeMs: number
  p95TimeMs: number
  rows: number
  firstSeenAt: string
  lastSeenAt: string
  status: SlowQueryStatus
  reviewerId: string | null
  reviewNote: string | null
  reviewedAt: string | null
  indexSuggestion?: IndexSuggestion | null
}

export interface IndexSuggestion {
  table: string
  columns: string[]
  reason: string
  existingIndexes: string[]
}

export interface SlowQueryListParams {
  pageNum?: number
  pageSize?: number
  keyword?: string
  status?: SlowQueryStatus
  minMeanMs?: number
  minTotalMs?: number
  orderBy?: 'mean' | 'total' | 'calls' | 'last_seen'
}

export interface SlowQueryStats {
  total: number
  open: number
}

export function getSlowQueryList(params: SlowQueryListParams) {
  return request.get<{ list: SlowQueryRecord[]; total: number }>('/monitor/slow-query/list', params)
}

export function getSlowQueryStats() {
  return request.get<SlowQueryStats>('/monitor/slow-query/stats')
}

export function getSlowQueryDetail(id: string) {
  return request.get<SlowQueryRecord>(`/monitor/slow-query/${id}`)
}

export function reviewSlowQuery(id: string, data: { status: 'resolved' | 'ignored'; note?: string }) {
  return request.put(`/monitor/slow-query/${id}/review`, data)
}
