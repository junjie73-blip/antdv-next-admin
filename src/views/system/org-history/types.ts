/** 变更历史记录 */
export interface OrgHistoryEvent {
  historyId: string
  entityType: 'dept' | 'user' | 'user_dept' | 'user_role'
  entityId: string
  changeType: string
  scope: string | null
  beforeData: Record<string, unknown> | null
  afterData: Record<string, unknown> | null
  summary: string | null
  source: string
  operatorId: string | null
  operatorName: string | null
  ipAddress: string | null
  traceId: string | null
  relatedId: string | null
  createdAt: string
}

/** 列表请求参数 */
export interface OrgHistoryListParams {
  pageNum: number
  pageSize: number
  entityType?: string
  scope?: string
  changeType?: string
  startTime?: string
  endTime?: string
}

/** 列表响应 */
export interface OrgHistoryListResult {
  list: OrgHistoryEvent[]
  total: number
}

/** 字段级 diff */
export interface FieldDiff {
  field: string
  before: unknown
  after: unknown
}

/** 员工时间线 */
export interface UserTimeline {
  events: Array<{
    historyId: string
    entityType: string
    changeType: string
    summary: string | null
    scope: string | null
    operatorName: string | null
    source: string
    createdAt: string
    before: Record<string, unknown> | null
    after: Record<string, unknown> | null
  }>
  currentDepts: Array<{ deptId: string; deptName: string; isPrimary: boolean }>
}

/** 变更统计 */
export interface OrgHistoryStatItem {
  scope: string
  count: number
}
