import { request } from '~/composables'
/* ============================================================
 * 类型
 * ============================================================ */
export type EntityType = 'dept' | 'user' | 'user_dept' | 'user_role'
export type ChangeType = 'create' | 'update' | 'delete' | 'move' | 'transfer' | 'assign' | 'revoke'
export type Scope = 'dept_tree' | 'user_profile' | 'user_dept' | 'user_role' | 'position'

export interface OrgOverview {
  total: number
  last30dByScope: Array<{ scope: string | null; count: number }>
  topChangeType: { changeType: string; count: number } | null
  latest: { summary: string | null; created_at: string; operator_name: string | null } | null
}

export interface OrgTrend {
  dates: string[]
  scopes: string[]
  series: Array<{ name: string; data: number[] }>
}

export interface DeptTransferHeat {
  deptId: string
  deptName: string
  inCount: number
  outCount: number
  net: number
}

export interface TopOperator {
  operator_id: string
  operator_name: string
  count: number
}

export interface DeptTimeMatrix {
  dates: string[]
  depts: string[]
  deptIds: string[]
  data: Array<[number, number, number]>
  max: number
  metric: 'total' | 'assign' | 'revoke'
}

export interface RevertChainNode {
  historyId: string
  summary: string | null
  changeType: ChangeType
  source: string
  operatorName: string | null
  createdAt: string
  revertedAt: string | null
  revertReason: string | null
}

/* ============================================================
 * 接口
 * ============================================================ */
export function getOrgOverview(): Promise<OrgOverview> {
  return request.get<OrgOverview>('/system/org-history/dashboard/overview').then(
    (r) =>
      r?.data ??
      r ?? {
        total: 0,
        last30dByScope: [],
        topChangeType: null,
        latest: null,
      },
  )
}

export function getOrgDailyTrend(days = 30): Promise<OrgTrend> {
  return request
    .get<OrgTrend>('/system/org-history/dashboard/daily-trend', { days })
    .then((r) => r?.data ?? r ?? { dates: [], scopes: [], series: [] })
}

export function getOrgDeptTransfer(days = 30): Promise<DeptTransferHeat[]> {
  return request
    .get<DeptTransferHeat[]>('/system/org-history/dashboard/dept-heatmap', { days })
    .then((r) => r?.data ?? r ?? [])
}

export function getOrgTopOperators(days = 30, limit = 10): Promise<TopOperator[]> {
  return request
    .get<TopOperator[]>('/system/org-history/dashboard/top-operators', { days, limit })
    .then((r) => r?.data ?? r ?? [])
}

export function getOrgDeptTimeMatrix(
  days = 30,
  metric: 'total' | 'assign' | 'revoke' = 'total',
): Promise<DeptTimeMatrix> {
  return request
    .get<DeptTimeMatrix>('/system/org-history/dashboard/dept-time-matrix', {
      days,
      metric,
    })
    .then((r) => r?.data ?? r ?? { dates: [], depts: [], deptIds: [], data: [], max: 0, metric })
}

export function getOrgRecentChanges(limit = 20): Promise<any[]> {
  return request
    .get<any[]>('/system/org-history/list', {
      pageNum: 1,
      pageSize: limit,
    })
    .then((r) => r?.data?.list ?? r?.list ?? [])
}

export function getRevertChain(historyId: string): Promise<{ chain: RevertChainNode[] }> {
  return request
    .get<{ chain: RevertChainNode[] }>(`/system/org-history/${historyId}/revert-chain`)
    .then((r) => r?.data ?? r ?? { chain: [] })
}

export const orgHistoryApi = {
  getOverview: getOrgOverview,
  getDailyTrend: getOrgDailyTrend,
  getDeptTransfer: getOrgDeptTransfer,
  getTopOperators: getOrgTopOperators,
  getDeptTimeMatrix: getOrgDeptTimeMatrix,
  getRecentChanges: getOrgRecentChanges,
  getRevertChain,
} as const
