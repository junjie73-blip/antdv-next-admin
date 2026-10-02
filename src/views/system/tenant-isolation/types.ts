/** 概览 KPI */
export interface IsolationOverview {
  pendingCritical: number
  pendingWarning: number
  pendingInfo: number
  resolvedTotal: number
  totalRuns: number
  lastRunAt: string | null
  lastRunStatus: string | null
}

/** 趋势序列 */
export interface IsolationTrend {
  dates: string[]
  newCounts: number[]
  resolvedCounts: number[]
  criticalSeries: number[]
  warningSeries: number[]
}

/** 严重程度 */
export type RuleSeverity = 'critical' | 'warning' | 'info'

/** 规则分布 */
export interface RuleDistribution {
  ruleCode: string
  severity: RuleSeverity
  count: number
}

/** 表热度 */
export interface TableHeat {
  tableName: string
  issueCount: number
  maxHit: number
}

/** 一次扫描运行记录 */
export interface IsolationRun {
  run_id: string
  trigger_type: string
  status: string
  criticalCount: number
  warningCount: number
  infoCount: number
  newCount: number
  resolvedCount: number
  durationMs: number | null
  startedAt: string
  finished_at: string | null
}
