/**
 * 审批流数据层 —— 「我的审批 / 流程分组 / 流程监控」三页共用同一份 SQLite 数据。
 *
 * 设计口径与 project.ts 一致：
 * - 三张表（tb_approval / tb_approval_group / tb_approval_instance）由 defineCollection
 *   声明，业务 id 为 number，_pk 交给 defineCollection 内部管理；
 * - 种子是手写的确定性数据（零 faker / Math.random / Date.now），只在库为空时写入一次；
 * - 所有状态流转与字段白名单都收敛在这里，handler 只负责把失败结果转成 bizError。
 *
 * 关联关系：approval.groupId → group.id；instance.groupName → group.name。
 * 这样「单据属于哪个分组」「实例属于哪个分组」是真实可校验的，而不是三个互不相干的列表。
 */

import dayjs from 'dayjs';

import { defineCollection, nextBizId } from './sqlite';

/* -------------------------------------------------------------------------- */
/* 类型与常量                                                                   */
/* -------------------------------------------------------------------------- */

export type ApprovalStatus = 'approved' | 'pending' | 'rejected';
export type ApprovalGroupStatus = 'disabled' | 'enabled';
export type ApprovalInstanceStatus = 'done' | 'error' | 'running';

export interface ApprovalRecord {
  /** 金额 / 天数，展示串 */
  amount: string;
  applicant: string;
  approver: string;
  code: string;
  /** 提交时间 */
  date: string;
  groupId: number;
  id: number;
  reason: string;
  status: ApprovalStatus;
  title: string;
  type: string;
  updatedAt: string;
}

export interface ApprovalGroupRecord {
  code: string;
  description: string;
  id: number;
  name: string;
  owner: number | string;
  processCount: number;
  status: ApprovalGroupStatus;
  updatedAt: string;
}

export interface ApprovalInstanceRecord {
  code: string;
  duration: string;
  /** 完成后置为种子业务日，供「今日完结」统计 */
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

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  approved: '已通过',
  pending: '待审批',
  rejected: '已驳回',
};

export const APPROVAL_GROUP_STATUS_LABELS: Record<ApprovalGroupStatus, string> =
  {
    disabled: '停用',
    enabled: '启用',
  };

export const APPROVAL_INSTANCE_STATUS_LABELS: Record<
  ApprovalInstanceStatus,
  string
> = {
  done: '已完结',
  error: '异常',
  running: '处理中',
};

export const APPROVAL_TYPES = ['费用报销', '请假', '采购', '权限申请'] as const;

/** mock 固定业务日：种子与「今日完结」统计都以此为基准，保证零随机、可复现 */
export const MOCK_TODAY = '2026-11-13';

/**
 * 「我的」视角把账号映射成固定人员，与 project.ts 的 MINE_OWNER_MAP 同思路：
 * 两个账号看到的「我发起的 / 待我审批」集合不同，可用于验证两条过滤分支。
 */
export const APPROVAL_ACCOUNT_PERSONS: Record<
  string,
  { applicant: string; approver: string }
> = {
  admin: { applicant: '王一', approver: '周珂' },
  custom: { applicant: '周珂', approver: '林晓' },
};

export function accountPersons(username: string): {
  applicant: string;
  approver: string;
} {
  return APPROVAL_ACCOUNT_PERSONS[username] ?? APPROVAL_ACCOUNT_PERSONS.admin!;
}

function now(): string {
  return dayjs().format('YYYY-MM-DD HH:mm:ss');
}

/* -------------------------------------------------------------------------- */
/* 结果封装：db 层明确返回成败，接口层统一转 success / bizError                   */
/* -------------------------------------------------------------------------- */

export interface DbResult<T> {
  code: number;
  data?: T;
  message: string;
  ok: boolean;
}

function ok<T>(data: T, message: string): DbResult<T> {
  return { code: 200, data, message, ok: true };
}

function fail<T>(code: number, message: string): DbResult<T> {
  return { code, message, ok: false };
}

/* -------------------------------------------------------------------------- */
/* 手写初始化数据（零随机）                                                     */
/* -------------------------------------------------------------------------- */

const GROUP_SEED: ApprovalGroupRecord[] = [
  {
    code: 'GR-01',
    description: '全员',
    id: 1,
    name: '人事类',
    owner: '林晓',
    processCount: 6,
    status: 'enabled',
    updatedAt: '2026-11-12 10:00:00',
  },
  {
    code: 'GR-02',
    description: '财务/管理',
    id: 2,
    name: '财务类',
    owner: '周珂',
    processCount: 8,
    status: 'enabled',
    updatedAt: '2026-11-12 10:00:00',
  },
  {
    code: 'GR-03',
    description: '采购/管理',
    id: 3,
    name: '采购类',
    owner: '陈默',
    processCount: 4,
    status: 'enabled',
    updatedAt: '2026-11-12 10:00:00',
  },
  {
    code: 'GR-04',
    description: '研发',
    id: 4,
    name: '权限类',
    owner: '苏叶',
    processCount: 3,
    status: 'enabled',
    updatedAt: '2026-11-12 10:00:00',
  },
  {
    code: 'GR-05',
    description: '全员',
    id: 5,
    name: '行政类',
    owner: '王一',
    processCount: 5,
    status: 'enabled',
    updatedAt: '2026-11-12 10:00:00',
  },
  {
    code: 'GR-06',
    description: '管理员',
    id: 6,
    name: '历史归档',
    owner: '林晓',
    processCount: 3,
    status: 'disabled',
    updatedAt: '2026-11-12 10:00:00',
  },
];

const APPROVAL_SEED: ApprovalRecord[] = [
  {
    amount: '¥ 2,480',
    applicant: '王一',
    approver: '周珂',
    code: 'AP-8801',
    date: '2026-11-13 09:20',
    groupId: 2,
    id: 1,
    reason: '',
    status: 'pending',
    title: '差旅报销申请',
    type: '费用报销',
    updatedAt: '2026-11-13 09:20:00',
  },
  {
    amount: '3 天',
    applicant: '李珊',
    approver: '林晓',
    code: 'AP-8802',
    date: '2026-11-12 16:05',
    groupId: 1,
    id: 2,
    reason: '',
    status: 'pending',
    title: '年假申请（3 天）',
    type: '请假',
    updatedAt: '2026-11-12 16:05:00',
  },
  {
    amount: '¥ 18,600',
    applicant: '周珂',
    approver: '陈默',
    code: 'AP-8803',
    date: '2026-11-10 11:32',
    groupId: 3,
    id: 3,
    reason: '预算内，同意采购',
    status: 'approved',
    title: '服务器扩容采购',
    type: '采购',
    updatedAt: '2026-11-11 09:00:00',
  },
  {
    amount: '—',
    applicant: '陈默',
    approver: '苏叶',
    code: 'AP-8804',
    date: '2026-11-08 14:18',
    groupId: 4,
    id: 4,
    reason: '按流程开通只读权限',
    status: 'approved',
    title: '外部接口开通',
    type: '权限申请',
    updatedAt: '2026-11-09 10:30:00',
  },
  {
    amount: '1 天',
    applicant: '苏叶',
    approver: '林晓',
    code: 'AP-8805',
    date: '2026-11-06 10:02',
    groupId: 1,
    id: 5,
    reason: '调休余额不足',
    status: 'rejected',
    title: '加班调休申请',
    type: '请假',
    updatedAt: '2026-11-07 09:00:00',
  },
  {
    amount: '¥ 8,900',
    applicant: '林晓',
    approver: '周珂',
    code: 'AP-8806',
    date: '2026-11-13 08:40',
    groupId: 2,
    id: 6,
    reason: '',
    status: 'pending',
    title: '市场活动预算',
    type: '费用报销',
    updatedAt: '2026-11-13 08:40:00',
  },
  {
    amount: '¥ 1,200',
    applicant: '李珊',
    approver: '陈默',
    code: 'AP-8807',
    date: '2026-11-11 15:10',
    groupId: 3,
    id: 7,
    reason: '',
    status: 'pending',
    title: '办公设备领用',
    type: '采购',
    updatedAt: '2026-11-11 15:10:00',
  },
  {
    amount: '—',
    applicant: '王一',
    approver: '苏叶',
    code: 'AP-8808',
    date: '2026-11-09 13:20',
    groupId: 4,
    id: 8,
    reason: '权限范围超出岗位需要',
    status: 'rejected',
    title: '系统权限变更',
    type: '权限申请',
    updatedAt: '2026-11-10 09:15:00',
  },
  {
    amount: '¥ 3,600',
    applicant: '陈默',
    approver: '周珂',
    code: 'AP-8809',
    date: '2026-11-07 17:45',
    groupId: 2,
    id: 9,
    reason: '票据齐全，同意报销',
    status: 'approved',
    title: '培训费用报销',
    type: '费用报销',
    updatedAt: '2026-11-08 11:00:00',
  },
  {
    amount: '2 天',
    applicant: '周珂',
    approver: '林晓',
    code: 'AP-8810',
    date: '2026-11-05 09:05',
    groupId: 1,
    id: 10,
    reason: '',
    status: 'pending',
    title: '调休假申请',
    type: '请假',
    updatedAt: '2026-11-05 09:05:00',
  },
];

const INSTANCE_SEED: ApprovalInstanceRecord[] = [
  {
    code: 'IN-3101',
    duration: '1.4h',
    finishedAt: '',
    groupName: '财务类',
    id: 1,
    name: '差旅报销',
    node: '部门经理审批',
    owner: '周珂',
    startTime: '2026-11-13 09:20',
    status: 'running',
    updatedAt: '2026-11-13 09:20:00',
  },
  {
    code: 'IN-3102',
    duration: '0.6h',
    finishedAt: '',
    groupName: '人事类',
    id: 2,
    name: '请假申请',
    node: 'HR 备案',
    owner: '林晓',
    startTime: '2026-11-13 08:30',
    status: 'running',
    updatedAt: '2026-11-13 08:30:00',
  },
  {
    code: 'IN-3103',
    duration: '8.1h',
    finishedAt: '',
    groupName: '采购类',
    id: 3,
    name: '采购申请',
    node: '财务复核',
    owner: '陈默',
    startTime: '2026-11-13 02:10',
    status: 'error',
    updatedAt: '2026-11-13 10:20:00',
  },
  {
    code: 'IN-3104',
    duration: '2.0h',
    finishedAt: MOCK_TODAY,
    groupName: '权限类',
    id: 4,
    name: '权限开通',
    node: '完成',
    owner: '苏叶',
    startTime: '2026-11-13 07:00',
    status: 'done',
    updatedAt: '2026-11-13 09:00:00',
  },
  {
    code: 'IN-3105',
    duration: '4.5h',
    finishedAt: '',
    groupName: '财务类',
    id: 5,
    name: '合同审批',
    node: '法务审核',
    owner: '周珂',
    startTime: '2026-11-13 05:30',
    status: 'running',
    updatedAt: '2026-11-13 10:00:00',
  },
  {
    code: 'IN-3106',
    duration: '1.8h',
    finishedAt: MOCK_TODAY,
    groupName: '财务类',
    id: 6,
    name: '费用报销',
    node: '完成',
    owner: '王一',
    startTime: '2026-11-13 08:00',
    status: 'done',
    updatedAt: '2026-11-13 09:48:00',
  },
  {
    code: 'IN-3107',
    duration: '6.2h',
    finishedAt: '',
    groupName: '人事类',
    id: 7,
    name: '入职流程',
    node: '背景调查',
    owner: '林晓',
    startTime: '2026-11-13 03:40',
    status: 'error',
    updatedAt: '2026-11-13 10:00:00',
  },
  {
    code: 'IN-3108',
    duration: '0.9h',
    finishedAt: '',
    groupName: '行政类',
    id: 8,
    name: '用章申请',
    node: '行政复核',
    owner: '李珊',
    startTime: '2026-11-13 10:10',
    status: 'running',
    updatedAt: '2026-11-13 10:10:00',
  },
];

/* -------------------------------------------------------------------------- */
/* 集合声明必须在种子之后：defineCollection 会立刻调用 seed()，提前声明会踩 TDZ   */
/* -------------------------------------------------------------------------- */

export const APPROVAL_DB: ApprovalRecord[] = defineCollection<ApprovalRecord>({
  seed: () => APPROVAL_SEED.map((item) => ({ ...item })),
  table: 'tb_approval',
});
export const APPROVAL_GROUP_DB: ApprovalGroupRecord[] =
  defineCollection<ApprovalGroupRecord>({
    seed: () => GROUP_SEED.map((item) => ({ ...item })),
    table: 'tb_approval_group',
  });
export const APPROVAL_INSTANCE_DB: ApprovalInstanceRecord[] =
  defineCollection<ApprovalInstanceRecord>({
    seed: () => INSTANCE_SEED.map((item) => ({ ...item })),
    table: 'tb_approval_instance',
  });

/* -------------------------------------------------------------------------- */
/* 查询 / 统计                                                                 */
/* -------------------------------------------------------------------------- */

export function findApproval(id: number): ApprovalRecord | undefined {
  return APPROVAL_DB.find((item) => item.id === id);
}

export function findGroup(id: number): ApprovalGroupRecord | undefined {
  return APPROVAL_GROUP_DB.find((item) => item.id === id);
}

export interface ApprovalStats {
  approved: number;
  mineInitiated: number;
  minePending: number;
  pending: number;
  rejected: number;
  total: number;
}

/** 按账号汇总「待我审批 / 我发起的」；不传账号时按默认 admin 口径 */
export function summarizeApprovals(username = 'admin'): ApprovalStats {
  const rows = APPROVAL_DB;
  const persons = accountPersons(username);
  return {
    approved: rows.filter((row) => row.status === 'approved').length,
    mineInitiated: rows.filter((row) => row.applicant === persons.applicant)
      .length,
    minePending: rows.filter(
      (row) => row.status === 'pending' && row.approver === persons.approver,
    ).length,
    pending: rows.filter((row) => row.status === 'pending').length,
    rejected: rows.filter((row) => row.status === 'rejected').length,
    total: rows.length,
  };
}

export interface GroupStats {
  disabled: number;
  enabled: number;
  processCount: number;
  total: number;
}

export function summarizeGroups(): GroupStats {
  const rows = APPROVAL_GROUP_DB;
  return {
    disabled: rows.filter((row) => row.status === 'disabled').length,
    enabled: rows.filter((row) => row.status === 'enabled').length,
    processCount: rows.reduce(
      (sum, row) => sum + Number(row.processCount || 0),
      0,
    ),
    total: rows.length,
  };
}

export interface InstanceSummary {
  avgDurationHours: number;
  done: number;
  doneToday: number;
  error: number;
  running: number;
  total: number;
}

function hoursOf(duration: unknown): number {
  const value = Number.parseFloat(String(duration ?? ''));
  return Number.isFinite(value) ? value : 0;
}

/** 监控统计：状态计数 + 今日完结（种子业务日）+ 平均耗时（保留一位小数） */
export function summarizeInstances(): InstanceSummary {
  const rows = APPROVAL_INSTANCE_DB;
  const done = rows.filter((row) => row.status === 'done');
  const avg =
    rows.length > 0
      ? rows.reduce((sum, row) => sum + hoursOf(row.duration), 0) / rows.length
      : 0;
  return {
    avgDurationHours: Math.round(avg * 10) / 10,
    done: done.length,
    doneToday: done.filter((row) => row.finishedAt === MOCK_TODAY).length,
    error: rows.filter((row) => row.status === 'error').length,
    running: rows.filter((row) => row.status === 'running').length,
    total: rows.length,
  };
}

/* -------------------------------------------------------------------------- */
/* 审批单据：字段白名单 + 状态流转                                               */
/* -------------------------------------------------------------------------- */

function pickApprovalFields(
  data: Record<string, unknown>,
): Partial<ApprovalRecord> {
  const picked: Partial<ApprovalRecord> = {};
  if (data.title !== undefined) picked.title = String(data.title).trim();
  if (data.type !== undefined) picked.type = String(data.type).trim();
  if (data.applicant !== undefined)
    picked.applicant = String(data.applicant).trim();
  if (data.approver !== undefined)
    picked.approver = String(data.approver).trim();
  if (data.amount !== undefined) picked.amount = String(data.amount);
  if (data.date !== undefined) picked.date = String(data.date);
  if (data.groupId !== undefined) picked.groupId = Number(data.groupId);
  return picked;
}

function validApproval(row: ApprovalRecord): string {
  if (!row.title) return '请输入审批标题';
  if (!row.type) return '请选择流程类型';
  if (!row.applicant) return '请输入申请人';
  return '';
}

/** 新建或编辑单据：编辑时只更新白名单字段，必填项按合并后的结果校验 */
export function saveApproval(
  data: Record<string, unknown>,
): DbResult<ApprovalRecord> {
  const rawId = data.id;
  const editing = rawId !== undefined && rawId !== null && rawId !== '';
  const id = Number(rawId);

  if (editing) {
    if (!Number.isFinite(id) || id <= 0) return fail(400, '无效的审批单据ID');
    const index = APPROVAL_DB.findIndex((item) => item.id === id);
    if (index === -1) return fail(404, '审批单据不存在或已被删除');
    const merged: ApprovalRecord = {
      ...APPROVAL_DB[index]!,
      ...pickApprovalFields(data),
      updatedAt: now(),
    };
    const invalid = validApproval(merged);
    if (invalid) return fail(400, invalid);
    APPROVAL_DB[index] = merged;
    return ok(merged, '审批单据已保存');
  }

  const created: ApprovalRecord = {
    amount: '—',
    applicant: '',
    approver: '',
    code: `AP-${String(8800 + nextBizId('tb_approval'))}`,
    date: dayjs().format('YYYY-MM-DD HH:mm'),
    groupId: 0,
    id: nextBizId('tb_approval'),
    reason: '',
    status: 'pending',
    title: '',
    type: '',
    updatedAt: now(),
    ...pickApprovalFields(data),
  };
  const invalid = validApproval(created);
  if (invalid) return fail(400, invalid);
  APPROVAL_DB.push(created);
  return ok(created, '审批单据已创建');
}

/** 审批流转：只有 pending 可审批；approve → approved，reject → rejected（意见必填） */
export function transitionApproval(
  id: number,
  action: unknown,
  reason: unknown,
): DbResult<ApprovalRecord> {
  const index = APPROVAL_DB.findIndex((item) => item.id === id);
  if (index === -1) return fail(404, '审批单据不存在或已被删除');

  const current = APPROVAL_DB[index]!;
  if (current.status !== 'pending') {
    return fail(
      409,
      current.status === 'approved'
        ? '该单据已通过审批，不能再次审批'
        : '该单据已驳回，不能再次审批',
    );
  }
  if (action !== 'approve' && action !== 'reject')
    return fail(400, '不支持的审批操作');
  const text = String(reason ?? '').trim();
  if (!text) return fail(400, '请填写审批意见');

  const updated: ApprovalRecord = {
    ...current,
    reason: text,
    status: action === 'approve' ? 'approved' : 'rejected',
    updatedAt: now(),
  };
  APPROVAL_DB[index] = updated;
  return ok(updated, action === 'approve' ? '已通过审批' : '已驳回审批');
}

export function deleteApproval(id: number): DbResult<{ id: number }> {
  const index = APPROVAL_DB.findIndex((item) => item.id === id);
  if (index === -1) return fail(404, '审批单据不存在或已被删除');
  APPROVAL_DB.splice(index, 1);
  return ok({ id }, '审批单据已删除');
}

/* -------------------------------------------------------------------------- */
/* 分组：CRUD + 启停（status 走同一份 save，便于列表内快捷切换）                   */
/* -------------------------------------------------------------------------- */

function pickGroupFields(
  data: Record<string, unknown>,
): Partial<ApprovalGroupRecord> {
  const picked: Partial<ApprovalGroupRecord> = {};
  if (data.code !== undefined) picked.code = String(data.code).trim();
  if (data.name !== undefined) picked.name = String(data.name).trim();
  if (data.owner !== undefined) picked.owner = String(data.owner).trim();
  if (data.description !== undefined)
    picked.description = String(data.description);
  if (data.processCount !== undefined)
    picked.processCount = Number(data.processCount) || 0;
  if (data.status !== undefined)
    picked.status = data.status as ApprovalGroupStatus;
  return picked;
}

function validGroup(row: ApprovalGroupRecord): string {
  if (!row.name) return '请输入分组名称';
  if (!String(row.owner ?? '').trim()) return '请输入维护人';
  if (row.status !== 'enabled' && row.status !== 'disabled')
    return '分组状态不合法';
  return '';
}

export function saveGroup(
  data: Record<string, unknown>,
): DbResult<ApprovalGroupRecord> {
  const rawId = data.id;
  const editing = rawId !== undefined && rawId !== null && rawId !== '';
  const id = Number(rawId);

  if (editing) {
    if (!Number.isFinite(id) || id <= 0) return fail(400, '无效的分组ID');
    const index = APPROVAL_GROUP_DB.findIndex((item) => item.id === id);
    if (index === -1) return fail(404, '分组不存在或已被删除');
    const merged: ApprovalGroupRecord = {
      ...APPROVAL_GROUP_DB[index]!,
      ...pickGroupFields(data),
      updatedAt: now(),
    };
    const invalid = validGroup(merged);
    if (invalid) return fail(400, invalid);
    APPROVAL_GROUP_DB[index] = merged;
    return ok(merged, '分组已保存');
  }

  const nextId = nextBizId('tb_approval_group');
  const created: ApprovalGroupRecord = {
    code: `GR-${String(nextId).padStart(2, '0')}`,
    description: '',
    id: nextId,
    name: '',
    owner: '',
    processCount: 0,
    status: 'enabled',
    updatedAt: now(),
    ...pickGroupFields(data),
  };
  const invalid = validGroup(created);
  if (invalid) return fail(400, invalid);
  APPROVAL_GROUP_DB.push(created);
  return ok(created, '分组已创建');
}

export function deleteGroup(id: number): DbResult<{ id: number }> {
  const index = APPROVAL_GROUP_DB.findIndex((item) => item.id === id);
  if (index === -1) return fail(404, '分组不存在或已被删除');
  APPROVAL_GROUP_DB.splice(index, 1);
  return ok({ id }, '分组已删除');
}
