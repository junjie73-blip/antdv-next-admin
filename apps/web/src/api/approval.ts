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
export type ApprovalNodeStatus = 'approved' | 'current' | 'pending' | 'rejected' | 'skipped';
export type ApprovalSignMode = 'countersign' | 'sequential';

/** 审批节点：列表进度与详情时间线共用 */
export interface ApprovalFlowNode {
  actedAt: string;
  approver: string;
  comment: string;
  dueAt: string;
  kind: 'approval' | 'archive' | 'submit';
  step: number;
  status: ApprovalNodeStatus;
  title: string;
  reminded: boolean;
}

export interface ApprovalAiAssessment {
  generatedAt: string;
  risk: 'critical' | 'high' | 'low' | 'medium';
  source: string;
  suggestions: string[];
  summary: string;
}

export interface ApprovalRecord {
  aiAssessment?: ApprovalAiAssessment;
  amount: string;
  applicant: string;
  approver: string;
  /** 派生字段：当前用户能否处理该单据 */
  canApprove?: boolean;
  ccPersons?: string[];
  code: string;
  currentNode?: string;
  currentStep?: number;
  date: string;
  dueAt?: string;
  flowNodes?: ApprovalFlowNode[];
  groupId: number;
  id: number;
  overdue?: boolean;
  reason: string;
  signMode?: ApprovalSignMode;
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

/** 当前账号的审批身份，用于表单默认值与按钮显示 */
export interface ApprovalContext {
  applicant: string;
  approver: string;
  isSuperAdmin: boolean;
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

export interface ApprovalLevelRule {
  employee: string;
  enabled: 'disabled' | 'enabled';
  id: number;
  level: number;
  leader: string;
  timeoutHours: number;
  updatedAt: string;
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
      context: ApprovalContext;
      stats: ApprovalStats;
    }
  >('/approval/mine/list', params);
}
export function getApprovalDetail(id: number, refresh = false) {
  return get<ApprovalRecord>(`/approval/mine/${id}`, { refresh: refresh ? '1' : '' });
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
export function extendApprovalNodes(data: {
  additionalApprovers?: string[];
  ccPersons?: string[];
  id: number;
  signMode?: ApprovalSignMode;
}) {
  return post<ApprovalRecord>('/approval/mine/extend', data);
}

/* ---------------------------- AI 研判 / 超时 ---------------------------- */

export function assessApproval(id: number) {
  return post<ApprovalAiAssessment>('/approval/ai/assess', { id });
}
export function scanApprovalTimeouts() {
  return post<{
    count: number;
    reminders: Array<{ code: string; id: number; node: string; notified: string }>;
  }>('/approval/timeout/scan', {});
}

/* ------------------------------- 层级规则 ------------------------------- */

export function getApprovalLevelList(params?: Params) {
  return get<ListResult<ApprovalLevelRule>>('/approval/level/list', params);
}
export function saveApprovalLevel(data: Params) {
  return post<ApprovalLevelRule>('/approval/level/save', data);
}
export function deleteApprovalLevel(id: number) {
  return del<null>(`/approval/level/${id}`);
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
