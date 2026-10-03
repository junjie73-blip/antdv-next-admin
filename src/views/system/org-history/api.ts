import { http } from '~/utils'

import type {
  OrgHistoryEvent,
  OrgHistoryListParams,
  OrgHistoryListResult,
  OrgHistoryStatItem,
  UserTimeline,
} from './types'

/* -------------------- 列表 / 详情 / 撤销 -------------------- */

export const listOrgHistory = (params: any) => http.Get<OrgHistoryListResult>('/system/org-history/list', { params })

export const getOrgHistoryDetail = (id: string) => http.Get<OrgHistoryEvent>(`/system/org-history/${id}`)

export const revertOrgHistory = (id: string, reason?: string) =>
  http.Post(`/system/org-history/${id}/revert`, { reason })

export const getRevertChain = (id: string) => http.Get<OrgHistoryEvent[]>(`/system/org-history/${id}/revert-chain`)

/* -------------------- 时间线 / 回溯 -------------------- */

export const getUserTimeline = (userId: string, limit = 200) =>
  http.Get<UserTimeline>(`/system/org-history/user/${userId}/timeline`, {
    params: { limit },
  })

export const getDeptTimeline = (deptId: string, limit = 200) =>
  http.Get<OrgHistoryEvent[]>(`/system/org-history/dept/${deptId}/timeline`, {
    params: { limit },
  })

export const getUserDeptAt = (userId: string, at: string) =>
  http.Get<string[]>(`/system/org-history/user/${userId}/dept-at`, {
    params: { at },
  })

/* -------------------- 统计 -------------------- */

export const getOrgHistoryStats = (days = 30) =>
  http.Get<OrgHistoryStatItem[]>('/system/org-history/stats', {
    params: { days },
  })
