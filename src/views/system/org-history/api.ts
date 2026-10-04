import { request } from '~/composables'

import type {
  OrgHistoryEvent,
  OrgHistoryListParams,
  OrgHistoryListResult,
  OrgHistoryStatItem,
  UserTimeline,
} from './types'

/* -------------------- 列表 / 详情 / 撤销 -------------------- */

export const listOrgHistory = (params: any) => request.get<OrgHistoryListResult>('/system/org-history/list', params)

export const getOrgHistoryDetail = (id: string) => request.get<OrgHistoryEvent>(`/system/org-history/${id}`)

export const revertOrgHistory = (id: string, reason?: string) =>
  request.post(`/system/org-history/${id}/revert`, { reason })

export const getRevertChain = (id: string) => request.get<OrgHistoryEvent[]>(`/system/org-history/${id}/revert-chain`)

/* -------------------- 时间线 / 回溯 -------------------- */

export const getUserTimeline = (userId: string, limit = 200) =>
  request.get<UserTimeline>(`/system/org-history/user/${userId}/timeline`, {
    limit,
  })

export const getDeptTimeline = (deptId: string, limit = 200) =>
  request.get<OrgHistoryEvent[]>(`/system/org-history/dept/${deptId}/timeline`, {
    limit,
  })

export const getUserDeptAt = (userId: string, at: string) =>
  request.get<string[]>(`/system/org-history/user/${userId}/dept-at`, {
    at,
  })

/* -------------------- 统计 -------------------- */

export const getOrgHistoryStats = (days = 30) =>
  request.get<OrgHistoryStatItem[]>('/system/org-history/stats', {
    days,
  })
