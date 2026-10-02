import { http } from '~/utils'

export interface LogEntry {
  timestamp: number
  message: string
  labels: Record<string, string>
}

export interface QuickSearchParams {
  keyword?: string
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  module?: string
  tenantId?: string
  sinceMinutes?: number
  limit?: number
}

export interface LogQueryParams {
  start: number
  end: number
  query: string
  limit?: number
  direction?: 'forward' | 'backward'
}

export function getLogStatus() {
  return http.Get<{ enabled: boolean }>('/monitor/logs/status')
}

export function quickSearchLogs(params: QuickSearchParams) {
  return http.Get<{ logs: LogEntry[]; total: number; lokiQuery: string }>('/monitor/logs/quick-search', { params })
}

export function queryLogs(params: LogQueryParams) {
  return http.Post<{ logs: LogEntry[]; total: number }>('/monitor/logs/query', params)
}

export function queryLogsByTrace(traceId: string, limit = 500) {
  return http.Get<{ logs: LogEntry[]; total: number }>(`/monitor/logs/by-trace/${traceId}`, {
    params: { limit },
  })
}
