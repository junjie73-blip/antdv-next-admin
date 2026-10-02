import { http } from '~/utils'

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
  return http.Get<{ list: SlowQueryRecord[]; total: number }>('/monitor/slow-query/list', { params }).send(true)
}

export function getSlowQueryStats() {
  return http.Get<SlowQueryStats>('/monitor/slow-query/stats').send(true)
}

export function getSlowQueryDetail(id: string) {
  return http.Get<SlowQueryRecord>(`/monitor/slow-query/${id}`).send(true)
}

export function reviewSlowQuery(id: string, data: { status: 'resolved' | 'ignored'; note?: string }) {
  return http.Put(`/monitor/slow-query/${id}/review`, data).send(true)
}
