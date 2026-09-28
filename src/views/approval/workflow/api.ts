import { http } from '~/utils'

import type { ApprovalFlowRecord, ApprovalFlowDetail, ApprovalFormValues, RejectFormValues } from './types'

interface PageResult<T> {
  list: T[]
  total: number
}

export interface ApprovalFlowSearchParams {
  title?: string
  status?: string
  page?: number
  pageSize?: number
}

/** 审批流程列表 */
export function getApprovalFlowList(params: ApprovalFlowSearchParams) {
  return http.Get<PageResult<ApprovalFlowRecord>>('/approval/flow/list', { params })
}

/** 审批流程详情 */
export function getApprovalFlowDetail(id: string) {
  return http.Get<{ data: ApprovalFlowDetail }>(`/approval/flow/detail/${id}`).send(true)
}

/** 发起审批 */
export function createApproval(data: ApprovalFormValues) {
  return http.Post<ApprovalFlowRecord>('/approval/request', data)
}

/** 重新提交（驳回后） */
export function resubmitApproval(id: string, data: ApprovalFormValues) {
  return http.Post<void>(`/approval/request/${id}/resubmit`, data)
}

/** 审批通过 */
export function approveApproval(id: string, remark?: string) {
  return http.Post<void>(`/approval/request/${id}/approve`, { remark })
}

/** 审批驳回 */
export function rejectApproval(id: string, data: RejectFormValues) {
  return http.Post<void>(`/approval/request/${id}/reject`, data)
}

/** 删除 */
export function deleteApproval(id: string) {
  return http.Delete<void>(`/approval/request/remove/${id}`)
}

/** 待办列表 */
export function getApprovalTasks(params?: { page?: number; pageSize?: number }) {
  return http.Get<PageResult<ApprovalFlowRecord>>('/approval/request/tasks', { params })
}
