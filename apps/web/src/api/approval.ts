import { del, get, post } from './request';

/**
 * 审批流接口层（对应 backend-mock 的 `server/api/approval/**`）。
 *
 * 三页共用一份 SQLite 数据：单据状态流转、分组启停都在后端完成，
 * 前端只负责发请求与 reload，不在本地改数字或状态。
 */

export type ApprovalStatus = 'approved' | 'pending' | 'rejected';
export type ApprovalGroupStatus = 'disabled' | 'enabled';
export type ApprovalInstanceStatus = 'done' | 'error' | 'running';
export type ApprovalAction = 'approve' | 'reject';

export interface ApprovalRecord {
  amount: string;
  applicant: string;
  approver: string;
  code: string;
  date: string;
  groupId: number;
  id: number;
  reason: string;
  status: ApprovalStatus;
  title: string;
  type: string;
  updatedAt: string;
}

export interface ApprovalGroup {
  code: string;
  description: string;
  id: number;
  name: string;
  owner: number | string;
  processCount: number;
  status: ApprovalGroupStatus;
  updatedAt: string;
}

export interface ApprovalInstance {
  code: string;
  duration: string;
  finishedAt: string;
  groupName: string;
  id: number;
  name: string;
  node: string;
  owner: string;
  startTime: string;
  status: ApprovalInstanceStatus;
  updatedAt: string;
}

export interface ApprovalStats {
  approved: number;
  mineInitiated: number;
  minePending: number;
  pending: number;
  rejected: number;
  total: number;
}

export interface ApprovalGroupStats {
  disabled: number;
  enabled: number;
  processCount: number;
  total: number;
}

export interface ApprovalInstanceSummary {
  avgDurationHours: number;
  done: number;
  doneToday: number;
  error: number;
  running: number;
  total: number;
}

type ListResult<T> = {
  list: T[];
  total: number;
};
type Params = Record<string, unknown>;

/* ------------------------------- 我的审批 ------------------------------- */

export function getApprovalMineList(params?: Params) {
  return get<
    ListResult<ApprovalRecord> & {
      stats: ApprovalStats;
    }
  >('/approval/mine/list', params);
}
export function saveApprovalRecord(data: Params) {
  return post<ApprovalRecord>('/approval/mine/save', data);
}
export function deleteApprovalRecord(id: number) {
  return del<null>(`/approval/mine/${id}`);
}
export function submitApprovalAction(data: {
  action: ApprovalAction;
  id: number;
  reason: string;
}) {
  return post<{
    approval: ApprovalRecord;
    stats: ApprovalStats;
  }>('/approval/mine/action', data);
}

/* ------------------------------- 流程分组 ------------------------------- */

export function getApprovalGroupList(params?: Params) {
  return get<
    ListResult<ApprovalGroup> & {
      stats: ApprovalGroupStats;
    }
  >('/approval/group/list', params);
}
export function saveApprovalGroup(data: Params) {
  return post<ApprovalGroup>('/approval/group/save', data);
}
export function deleteApprovalGroup(id: number) {
  return del<null>(`/approval/group/${id}`);
}

/* ------------------------------- 流程监控 ------------------------------- */

export function getApprovalInstanceList(params?: Params) {
  return get<ListResult<ApprovalInstance>>('/approval/monitor/list', params);
}
export function getApprovalMonitorSummary() {
  return get<ApprovalInstanceSummary>('/approval/monitor/summary');
}
