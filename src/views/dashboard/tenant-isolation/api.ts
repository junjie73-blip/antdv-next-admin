import { put } from '~/api/request'
import { http } from '~/composables'

/* ============================================================
 * 类型（严格对齐后端）
 * ============================================================ */
export type Severity = 'critical' | 'warning' | 'info'
export type ScanType = 'schema' | 'query' | 'runtime'
export type RunStatus = 'running' | 'completed' | 'failed'
export type TriggerType = 'ci' | 'manual' | 'cron' | 'startup'

/** /dashboard/overview 返回 */
export interface IsolationOverview {
  pendingCritical: number
  pendingWarning: number
  pendingInfo: number
  resolvedTotal: number
  totalRuns: number
  lastRunAt: string | null
  lastRunStatus: RunStatus | null
}

/** /dashboard/trend 返回 */
export interface IsolationTrend {
  dates: string[]
  newCounts: number[]
  resolvedCounts: number[]
  criticalSeries: number[]
  warningSeries: number[]
}

/** /dashboard/rule-distribution 返回 */
export interface RuleDistribution {
  ruleCode: string
  severity: Severity
  count: number
}

/** /dashboard/table-heatmap 返回 */
export interface TableHeat {
  tableName: string
  issueCount: number
  maxHit: number
}

/** /dashboard/recent-runs 返回 */
export interface IsolationRun {
  run_id: string
  trigger_type: TriggerType
  status: RunStatus
  critical_count: number
  warning_count: number
  info_count: number
  new_count: number
  resolved_count: number
  duration_ms: number | null
  started_at: string
  finished_at: string | null
}

/** /list 返回 */
export interface IsolationViolation {
  scan_id: string
  scan_type: ScanType
  rule_code: string
  severity: Severity
  table_name: string
  column_name: string
  message: string
  suggestion: string | null
  resolved: number
  first_seen_at: string
  last_seen_at: string
  hit_count: number
}

export interface IsolationViolationListResult {
  list: IsolationViolation[]
  total: number
}

/** /summary 返回（与 overview 类似但可能字段不同） */
export interface IsolationSummary {
  pending: Array<{ severity: string; count: number }>
  runs: IsolationRun[]
}

/* ============================================================
 * 接口
 * ============================================================ */

/** 大屏 - 概览（首选） */
export function getIsolationOverview(): Promise<IsolationOverview> {
  return http.get<IsolationOverview>('/system/tenant-isolation/dashboard/overview').then(
    (r) =>
      r?.data ??
      r ?? {
        pendingCritical: 0,
        pendingWarning: 0,
        pendingInfo: 0,
        resolvedTotal: 0,
        totalRuns: 0,
        lastRunAt: null,
        lastRunStatus: null,
      },
  )
}

/** 概览（备用） */
export function getIsolationSummary(): Promise<IsolationSummary> {
  return http
    .get<IsolationSummary>('/system/tenant-isolation/summary')
    .then((r) => r?.data ?? r ?? { pending: [], runs: [] })
}

export function getIsolationTrend(days = 30): Promise<IsolationTrend> {
  return http
    .get<IsolationTrend>('/system/tenant-isolation/dashboard/trend', {
      days,
    })
    .then(
      (r) =>
        r?.data ??
        r ?? {
          dates: [],
          newCounts: [],
          resolvedCounts: [],
          criticalSeries: [],
          warningSeries: [],
        },
    )
}

export function getIsolationRuleDistribution(): Promise<RuleDistribution[]> {
  return http
    .get<RuleDistribution[]>('/system/tenant-isolation/dashboard/rule-distribution')
    .then((r) => r?.data ?? r ?? [])
}

export function getIsolationTableHeatmap(): Promise<TableHeat[]> {
  return http.get<TableHeat[]>('/system/tenant-isolation/dashboard/table-heatmap').then((r) => r?.data ?? r ?? [])
}

export function getIsolationRecentRuns(limit = 10): Promise<IsolationRun[]> {
  return http
    .get<IsolationRun[]>('/system/tenant-isolation/dashboard/recent-runs', { limit })
    .then((r) => r?.data ?? r ?? [])
}

export function getIsolationViolations(params: {
  pageNum?: number
  pageSize?: number
  severity?: Severity
  resolved?: number
  ruleCode?: string
}): Promise<IsolationViolationListResult> {
  return http.get<IsolationViolationListResult>('/system/tenant-isolation/list', params).then((r) => {
    const payload = r?.data ?? r
    return {
      list: payload?.list ?? [],
      total: payload?.total ?? 0,
    }
  })
}

export function triggerIsolationScan(): Promise<{ runId?: string }> {
  return http.post<{ runId?: string }>('/system/tenant-isolation/scan').then((r) => r?.data ?? r ?? {})
}

export function resolveIsolationViolation(id: string): Promise<void> {
  return http.put(`/system/tenant-isolation/${id}/resolve`)
}

export const tenantIsolationApi = {
  getOverview: getIsolationOverview,
  getSummary: getIsolationSummary,
  getTrend: getIsolationTrend,
  getRuleDistribution: getIsolationRuleDistribution,
  getTableHeatmap: getIsolationTableHeatmap,
  getRecentRuns: getIsolationRecentRuns,
  getViolations: getIsolationViolations,
  triggerScan: triggerIsolationScan,
  resolve: resolveIsolationViolation,
} as const
