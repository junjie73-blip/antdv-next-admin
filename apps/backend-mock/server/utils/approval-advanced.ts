/**
 * 审批流增强层：层级权限 / 节点流转 / 超时自动审批 / 驳回重提 / 追加审批人。
 *
 * 与 `db/approval.ts` 的职责边界：
 * - `approval.ts` 管三张基础表的 CRUD、统计与字段白名单（既有页面与单测都依赖它）；
 * - 本文件管「单据内部怎么流转」，所有新增字段都写回同一条 ApprovalRecord，
 *   前端列表/详情拿到的仍是同一份数据，不需要第二套状态真源。
 *
 * 设计约束：
 * 1. 权限判定以服务端为准：前端按钮只是展示，绕过 UI 直接调接口也会被 403 挡住；
 * 2. 审批结论只来自人工操作或超时规则，AI 不参与审批链路；
 * 3. 超时节点按层级规则的固定时限自动流转，结果落站内信（tb_notice）；
 * 4. 驳回重提在原单据上追加新一轮节点，历史轮次原样保留给 vue-flow 渲染；
 * 5. 所有数组字段整体回写（defineCollection 的 Proxy 只拦截顶层赋值）。
 */

import dayjs from 'dayjs';

import type { MockAccount } from './accounts';
import type { ApprovalFlowNode, ApprovalRecord } from './db/approval';

import { accountPersons, APPROVAL_DB, MOCK_TODAY } from './db/approval';
import { NOTICE_DB } from './db/notice';
import { defineCollection } from './db/sqlite';

/* -------------------------------------------------------------------------- */
/* 层级规则                                                                     */
/* -------------------------------------------------------------------------- */

export type ApprovalAutoAction = 'approve' | 'reject';
export type ApprovalRuleStatus = 'disabled' | 'enabled';
export type ApprovalSignMode = 'countersign' | 'sequential';

export interface ApprovalLevelRule {
  /** 超时后按规则给出的默认结论；内容命中红线时仍会强制驳回 */
  autoAction: ApprovalAutoAction;
  /** 自动通过金额上限（元），超出时改为驳回；0 表示不限制 */
  autoMaxAmount: number;
  employee: string;
  enabled: ApprovalRuleStatus;
  id: number;
  /** 审批层级：1 = 直接上级，2 = 上一级复核 */
  level: number;
  leader: string;
  /** 节点处理时限（小时） */
  timeoutHours: number;
  updatedAt: string;
}

const LEVEL_SEED: ApprovalLevelRule[] = [
  { employee: '王一', leader: '周珂' },
  { employee: '李珊', leader: '林晓' },
  { employee: '周珂', leader: '陈默' },
  { employee: '陈默', leader: '苏叶' },
  { employee: '苏叶', leader: '林晓' },
  { employee: '林晓', leader: '周珂' },
].map((item, index) => ({
  ...item,
  autoAction: 'approve' as const,
  autoMaxAmount: 10000,
  enabled: 'enabled' as const,
  id: index + 1,
  level: 1,
  timeoutHours: index === 2 ? 36 : 24,
  updatedAt: '2026-11-12 10:00:00',
}));

export const APPROVAL_LEVEL_DB = defineCollection<ApprovalLevelRule>({
  seed: () => LEVEL_SEED.map((item) => ({ ...item })),
  table: 'tb_approval_level',
});

export function findLevelRule(employee: string): ApprovalLevelRule | undefined {
  const name = String(employee ?? '').trim();
  return APPROVAL_LEVEL_DB.find(
    (rule) => rule.enabled === 'enabled' && rule.employee === name,
  );
}

/** 直接上级：规则里没有配置时返回空串，此时除超管外无人可审批 */
export function resolveLeader(employee: string): string {
  return findLevelRule(employee)?.leader ?? '';
}

/**
 * 超级管理员口径统一在这里：登录账号的 `permissions: ['*']` 或 admin 系角色。
 * 用户管理库里还有 `roles: ['超级管理员']` 的第三套写法，一并兼容。
 */
export function isApprovalSuperAdmin(account: MockAccount): boolean {
  return (
    account.permissions.includes('*') ||
    account.roles.some((role) =>
      ['admin', 'super', 'super_admin', '超级管理员'].includes(role),
    )
  );
}

/** 登录账号对应的「审批人」姓名，沿用原有账号→人员映射 */
export function approverPerson(account: MockAccount): string {
  return accountPersons(account.profile.username).approver;
}

/* -------------------------------------------------------------------------- */
/* 规则 CRUD（仅超级管理员可改）                                                 */
/* -------------------------------------------------------------------------- */

export interface AdvancedResult<T> {
  code: number;
  data?: T;
  message: string;
  ok: boolean;
}

function ok<T>(data: T, message: string): AdvancedResult<T> {
  return { code: 200, data, message, ok: true };
}

function fail<T>(code: number, message: string): AdvancedResult<T> {
  return { code, message, ok: false };
}

function now(): string {
  return dayjs().format('YYYY-MM-DD HH:mm:ss');
}

export function saveLevelRule(
  data: Record<string, unknown>,
  account: MockAccount,
): AdvancedResult<ApprovalLevelRule> {
  if (!isApprovalSuperAdmin(account))
    return fail(403, '仅超级管理员可配置审批层级规则');

  const employee = String(data.employee ?? '').trim();
  const leader = String(data.leader ?? '').trim();
  if (!employee) return fail(400, '请输入员工姓名');
  if (!leader) return fail(400, '请输入直接上级');
  if (employee === leader) return fail(400, '直接上级不能是员工本人');

  const level = Number(data.level ?? 1);
  const timeoutHours = Number(data.timeoutHours ?? 24);
  const autoMaxAmount = Number(data.autoMaxAmount ?? 10000);
  if (!Number.isInteger(level) || level < 1 || level > 9)
    return fail(400, '审批层级需为 1-9 的整数');
  if (
    !Number.isFinite(timeoutHours) ||
    timeoutHours < 1 ||
    timeoutHours > 720
  )
    return fail(400, '处理时限需在 1-720 小时之间');
  if (
    !Number.isFinite(autoMaxAmount) ||
    autoMaxAmount < 0 ||
    autoMaxAmount > 1_000_000
  )
    return fail(400, '自动通过上限需在 0-1000000 元之间');

  const autoAction: ApprovalAutoAction =
    data.autoAction === 'reject' ? 'reject' : 'approve';
  const enabled: ApprovalRuleStatus =
    data.enabled === 'disabled' ? 'disabled' : 'enabled';
  const rawId = data.id;
  const editing = rawId !== undefined && rawId !== null && rawId !== '';
  const id = Number(rawId);

  if (editing) {
    if (!Number.isFinite(id) || id <= 0) return fail(400, '无效的规则ID');
    const index = APPROVAL_LEVEL_DB.findIndex((item) => item.id === id);
    if (index === -1) return fail(404, '审批层级规则不存在');
    const duplicate = APPROVAL_LEVEL_DB.find(
      (item) => item.id !== id && item.employee === employee,
    );
    if (duplicate) return fail(409, '该员工已有层级规则，请编辑原规则');
    const updated: ApprovalLevelRule = {
      ...APPROVAL_LEVEL_DB[index]!,
      autoAction,
      autoMaxAmount,
      employee,
      enabled,
      leader,
      level,
      timeoutHours,
      updatedAt: now(),
    };
    APPROVAL_LEVEL_DB[index] = updated;
    return ok(updated, '层级规则已保存');
  }

  if (APPROVAL_LEVEL_DB.some((item) => item.employee === employee))
    return fail(409, '该员工已有层级规则，请编辑原规则');

  const created: ApprovalLevelRule = {
    autoAction,
    autoMaxAmount,
    employee,
    enabled,
    id: Number(
      APPROVAL_LEVEL_DB.reduce((max, item) => Math.max(max, item.id), 0) + 1,
    ),
    leader,
    level,
    timeoutHours,
    updatedAt: now(),
  };
  APPROVAL_LEVEL_DB.push(created);
  return ok(created, '层级规则已创建');
}

export function deleteLevelRule(
  id: number,
  account: MockAccount,
): AdvancedResult<{ id: number }> {
  if (!isApprovalSuperAdmin(account))
    return fail(403, '仅超级管理员可配置审批层级规则');
  const index = APPROVAL_LEVEL_DB.findIndex((item) => item.id === id);
  if (index === -1) return fail(404, '审批层级规则不存在');
  APPROVAL_LEVEL_DB.splice(index, 1);
  return ok({ id }, '层级规则已删除');
}

/* -------------------------------------------------------------------------- */
/* 节点构造                                                                     */
/* -------------------------------------------------------------------------- */

/** 从 `¥ 18,600` / `3 天` 这类展示串里取数值，仅用于金额阈值判断 */
function amountValue(record: ApprovalRecord): number {
  const matched = /[\d,]+(?:\.\d+)?/.exec(String(record.amount ?? ''));
  if (!matched) return 0;
  const value = Number(matched[0].replaceAll(',', ''));
  return Number.isFinite(value) ? value : 0;
}

function baseTime(record: ApprovalRecord): dayjs.Dayjs {
  const parsed = dayjs(record.date || record.updatedAt || MOCK_TODAY);
  return parsed.isValid() ? parsed : dayjs(MOCK_TODAY);
}

function archived(record: ApprovalRecord): boolean {
  return record.status !== 'pending';
}

/** 大额申请在直属上级之后自动追加一层复核节点，演示多级审批 */
function needUpperReview(record: ApprovalRecord): boolean {
  return amountValue(record) > 10000;
}

function makeNode(
  overrides: Partial<ApprovalFlowNode> &
    Pick<ApprovalFlowNode, 'kind' | 'step' | 'title'> & { round?: number },
): ApprovalFlowNode {
  return {
    actedAt: '',
    approver: '',
    auto: false,
    comment: '',
    dueAt: '',
    reminded: false,
    round: 1,
    status: 'pending',
    ...overrides,
  };
}

/**
 * 依据单据当前状态重建「一轮」节点快照；旧数据首次读取时自动补齐 round/auto。
 * 驳回重提时传入新的 round，返回的整组节点追加到既有节点之后，历史不会被覆盖。
 */
export function buildFlowNodes(
  record: ApprovalRecord,
  round = 1,
): ApprovalFlowNode[] {
  const submittedAt = record.date || record.updatedAt || MOCK_TODAY;
  const leader = resolveLeader(record.applicant) || record.approver || '待指定上级';
  const timeoutHours = findLevelRule(record.applicant)?.timeoutHours ?? 24;
  const firstDueAt = baseTime(record)
    .add(timeoutHours, 'hour')
    .format('YYYY-MM-DD HH:mm:ss');
  const done = archived(record);
  const rejected = record.status === 'rejected';

  const nodes: ApprovalFlowNode[] = [
    makeNode({
      actedAt: submittedAt.length === 16 ? `${submittedAt}:00` : submittedAt,
      approver: record.applicant,
      comment: '',
      kind: 'submit',
      round,
      status: 'approved',
      step: 1,
      title: '提交申请',
    }),
    makeNode({
      actedAt: done ? record.updatedAt : '',
      approver: leader,
      comment: done ? record.reason : '',
      dueAt: firstDueAt,
      kind: 'approval',
      round,
      status: rejected ? 'rejected' : done ? 'approved' : 'current',
      step: 2,
      title: '直属上级审批',
    }),
  ];

  if (needUpperReview(record)) {
    const upper = resolveLeader(leader) || '超级管理员';
    nodes.push(
      makeNode({
        actedAt: done && !rejected ? record.updatedAt : '',
        approver: upper,
        comment: '',
        dueAt: baseTime(record)
          .add(timeoutHours * 2, 'hour')
          .format('YYYY-MM-DD HH:mm:ss'),
        kind: 'approval',
        round,
        status: rejected ? 'skipped' : done ? 'approved' : 'pending',
        step: 3,
        title: '上级复核（金额阈值）',
      }),
    );
  }

  const archiveStep = nodes.length + 1;
  nodes.push(
    makeNode({
      actedAt: done && !rejected ? record.updatedAt : '',
      approver: '系统',
      kind: 'archive',
      round,
      status: rejected ? 'skipped' : done ? 'approved' : 'pending',
      step: archiveStep,
      title: '流程归档',
    }),
  );
  return nodes;
}

/**
 * 旧数据兼容：节点是整块 JSON 存进 SQLite 的，历史行没有 round/auto/currentRound。
 * 这里只补默认值，不重建已有节点，人工处理痕迹因此不会被冲掉。
 */
export function ensureFlow(record: ApprovalRecord): ApprovalRecord {
  if (!Array.isArray(record.flowNodes) || record.flowNodes.length === 0) {
    record.flowNodes = buildFlowNodes(record);
  } else {
    record.flowNodes = record.flowNodes.map((node) => ({
      auto: false,
      ...node,
      round: Number(node.round) || 1,
    }));
  }
  const maxRound = record.flowNodes.reduce(
    (max, node) => Math.max(max, node.round),
    1,
  );
  record.currentRound = Number(record.currentRound) || maxRound;
  return record;
}

/* -------------------------------------------------------------------------- */
/* 流转与权限                                                                   */
/* -------------------------------------------------------------------------- */

/** 只认当前轮次：历史轮次的节点已经定稿，不能被新一次操作改写 */
export function currentApprovalNode(
  record: ApprovalRecord,
): ApprovalFlowNode | undefined {
  const round = record.currentRound ?? 1;
  return (record.flowNodes ?? [])
    .filter(
      (node) =>
        node.round === round &&
        node.kind === 'approval' &&
        node.status !== 'approved' &&
        node.status !== 'rejected' &&
        node.status !== 'skipped',
    )
    .sort((a, b) => a.step - b.step)[0];
}

function refreshDerived(record: ApprovalRecord): void {
  const current = currentApprovalNode(record);
  const roundNodes = (record.flowNodes ?? []).filter(
    (node) => node.round === (record.currentRound ?? 1),
  );
  record.currentStep = current?.step ?? roundNodes.length;
  record.dueAt = current?.dueAt ?? '';
}

/** 登录账号对应的「发起人」姓名；编辑/重提只能用自己的身份 */
export function applicantPerson(account: MockAccount): string {
  return accountPersons(account.profile.username).applicant;
}

/**
 * 谁能处理当前节点：
 * - 超级管理员：全部单据；
 * - 直接上级 / 被追加的审批人：仅当前节点指派给自己的单据。
 * 这是一道服务端门槛，页面按钮隐藏只是体验优化。
 */
export function canApproveRecord(
  record: ApprovalRecord,
  account: MockAccount,
): boolean {
  if (isApprovalSuperAdmin(account)) return true;
  if (record.status !== 'pending') return false;
  const node = currentApprovalNode(record);
  if (!node) return false;
  const person = approverPerson(account);
  if (!person) return false;
  if (node.approver === person) return true;
  if (node.title === '直属上级审批' && resolveLeader(record.applicant) === person)
    return true;
  return false;
}

/** 编辑 / 删除 / 重提只对发起人开放，超管也不越权改别人的单据 */
export function canEditRecord(
  record: ApprovalRecord,
  account: MockAccount,
): boolean {
  const applicant = applicantPerson(account);
  return Boolean(applicant) && applicant === record.applicant;
}

export function canResubmitRecord(
  record: ApprovalRecord,
  account: MockAccount,
): boolean {
  return record.status === 'rejected' && canEditRecord(record, account);
}

/** 列表/详情返回给前端的派生字段，不写回数据库 */
export function enrichRecord(
  record: ApprovalRecord,
  account: MockAccount,
): Record<string, unknown> {
  const current = currentApprovalNode(record);
  const overdue = Boolean(
    current?.dueAt &&
      record.status === 'pending' &&
      dayjs(current.dueAt).isBefore(dayjs()),
  );
  // 旧行里可能残留已下线的 AI 研判字段，出参统一剥掉，避免重新流回前端
  const plain = { ...record } as Record<string, unknown>;
  delete plain.aiAssessment;
  return {
    ...plain,
    canApprove: record.status === 'pending' && canApproveRecord(record, account),
    canEdit: canEditRecord(record, account),
    canResubmit: canResubmitRecord(record, account),
    currentNode: current?.title ?? (record.status === 'approved' ? '已完结' : '已驳回'),
    currentRound: record.currentRound ?? 1,
    overdue,
    // DataPage 的进度列需要一个展示串；按当前轮次内的步骤展示
    progress: `${current?.step ?? 1}/${(record.flowNodes ?? []).filter((node) => node.round === (record.currentRound ?? 1)).length || 1}`,
  };
}

/**
 * 人工或超时规则给出的节点结论：核心流转只有这一处。
 * `auto=true` 只影响画布角标与提示文案，不改变状态机。
 */
function applyNodeDecision(
  record: ApprovalRecord,
  current: ApprovalFlowNode,
  action: ApprovalAutoAction,
  reason: string,
  actor: string,
  auto: boolean,
): string {
  const round = current.round;
  const nodes = (record.flowNodes ?? []).map((node) =>
    node === current
      ? {
          ...node,
          actedAt: now(),
          approver: actor || node.approver,
          auto,
          comment: reason,
          status: action,
        }
      : node,
  );

  let status: ApprovalRecord['status'] = 'pending';
  let message: string;
  if (action === 'reject') {
    status = 'rejected';
    message = auto ? '已按超时规则自动驳回' : '已驳回审批';
    for (const node of nodes) {
      if (
        node.round === round &&
        (node.kind === 'archive' ||
          (node.kind === 'approval' && node.status === 'pending'))
      )
        node.status = 'skipped';
    }
  } else {
    const pendingApprovals = nodes.filter(
      (node) =>
        node.round === round &&
        node.kind === 'approval' &&
        node.status === 'pending',
    );
    const sameStep = pendingApprovals.some((node) => node.step === current.step);
    if (pendingApprovals.length === 0) {
      status = 'approved';
      message = auto ? '已按超时规则自动通过' : '已通过审批';
      for (const node of nodes)
        if (node.round === round && node.kind === 'archive')
          node.status = 'approved';
    } else {
      message = sameStep
        ? '已通过当前会签节点，等待其他审批人'
        : '已通过当前节点，流转至下一审批人';
      // 会签组通过的节点保持原 step，下一批 pending 节点仍在同一 step；
      // 顺序审批则按 step 升序流转，currentApprovalNode 会取到正确节点。
    }
  }

  record.flowNodes = nodes;
  record.reason = reason;
  record.status = status;
  record.updatedAt = now();
  refreshDerived(record);
  return message;
}

/** 审批通过 / 驳回：多节点时逐节点流转，全部审批节点通过后才归档 */
export function applyApprovalAction(
  record: ApprovalRecord,
  action: unknown,
  reason: unknown,
  account: MockAccount,
): AdvancedResult<{ approval: Record<string, unknown>; message?: string }> {
  // 权限先判：越权请求不该从状态码里探到单据当前处于什么状态
  if (!canApproveRecord(record, account))
    return fail(403, '仅当前审批人、直接上级或超级管理员可处理此单据');
  if (record.status !== 'pending')
    return fail(
      409,
      record.status === 'approved'
        ? '该单据已通过审批，不能再次审批'
        : '该单据已驳回，不能再次审批',
    );
  if (action !== 'approve' && action !== 'reject')
    return fail(400, '不支持的审批操作');
  const text = String(reason ?? '').trim();
  if (!text) return fail(400, '请填写审批意见');

  ensureFlow(record);
  const current = currentApprovalNode(record);
  if (!current) return fail(409, '该单据没有待处理节点');

  const message = applyNodeDecision(
    record,
    current,
    action,
    text,
    approverPerson(account),
    false,
  );
  return ok({ approval: enrichRecord(record, account), message }, message);
}

/**
 * 驳回重提：原单据不删除、历史节点不覆盖，直接在后面追加一轮完整流程。
 * 金额/类型/申请人/所属分组沿用原材料，只有时间与审批意见按本轮更新。
 */
export function resubmitApproval(
  record: ApprovalRecord,
  reason: unknown,
  account: MockAccount,
): AdvancedResult<Record<string, unknown>> {
  if (!canResubmitRecord(record, account))
    return fail(403, '只有发起人可以基于驳回单据重新发起审批');
  if (record.status !== 'rejected') return fail(409, '只有被驳回的单据可以重新发起');

  ensureFlow(record);
  const nextRound = (record.currentRound ?? 1) + 1;
  const text = String(reason ?? '').trim() || record.reason;
  const fresh: ApprovalRecord = {
    ...record,
    date: now(),
    reason: text,
    status: 'pending',
    updatedAt: now(),
  };
  const roundNodes = buildFlowNodes(fresh, nextRound);
  record.flowNodes = [...(record.flowNodes ?? []), ...roundNodes];
  record.currentRound = nextRound;
  record.date = fresh.date;
  record.reason = text;
  record.status = 'pending';
  record.updatedAt = fresh.updatedAt;
  refreshDerived(record);
  pushNotice(
    `审批已重新发起：${record.title}`,
    `你发起的 ${record.code} 已基于原材料进入第 ${nextRound} 轮审批。`,
    record.applicant,
  );
  return ok(enrichRecord(record, account), `已重新发起第 ${nextRound} 轮审批`);
}

/* -------------------------------------------------------------------------- */
/* 追加审批人 / 抄送                                                            */
/* -------------------------------------------------------------------------- */

function cleanNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((item) => String(item ?? '').trim())
        .filter((name) => name.length > 0),
    ),
  ].slice(0, 5);
}

/** 上级审批人在处理过程中追加审批人 / 抄送对象，支持会签与顺序审批 */
export function extendApproval(
  record: ApprovalRecord,
  input: Record<string, unknown>,
  account: MockAccount,
): AdvancedResult<Record<string, unknown>> {
  if (record.status !== 'pending')
    return fail(409, '只有处理中的单据可以追加审批人');
  if (!canApproveRecord(record, account))
    return fail(403, '仅当前审批人、直接上级或超级管理员可调整审批节点');

  const mode: ApprovalSignMode =
    input.signMode === 'countersign' ? 'countersign' : 'sequential';
  const cc = cleanNames(input.ccPersons);
  const extra = cleanNames(input.additionalApprovers).filter(
    (name) => name !== record.applicant,
  );
  if (!cc.length && !extra.length)
    return fail(400, '请至少填写一个抄送对象或追加审批人');
  ensureFlow(record);
  const round = record.currentRound ?? 1;
  const nodes = [...(record.flowNodes ?? [])];
  const archiveIndex = nodes.findIndex(
    (node) => node.round === round && node.kind === 'archive',
  );
  const archive = archiveIndex >= 0 ? nodes[archiveIndex]! : undefined;
  if (archiveIndex >= 0) nodes.splice(archiveIndex, 1);

  const roundSteps = nodes
    .filter((node) => node.round === round)
    .map((node) => node.step);
  const baseStep = Math.max(0, ...roundSteps);
  extra.forEach((person, index) => {
    const node = makeNode({
      approver: person,
      dueAt: baseTime(record)
        .add((findLevelRule(record.applicant)?.timeoutHours ?? 24) * (index + 2), 'hour')
        .format('YYYY-MM-DD HH:mm:ss'),
      kind: 'approval',
      round,
      step: mode === 'countersign' ? baseStep + 1 : baseStep + index + 1,
      title: mode === 'countersign' ? '追加会签审批' : '追加顺序审批',
    });
    nodes.push(node);
  });

  if (archive) {
    nodes.push({
      ...archive,
      round,
      step: mode === 'countersign' ? baseStep + 2 : baseStep + extra.length + 1,
    });
  }

  record.flowNodes = nodes;
  record.ccPersons = [...new Set([...(record.ccPersons ?? []), ...cc])];
  record.signMode = mode;
  record.updatedAt = now();
  refreshDerived(record);

  return ok(enrichRecord(record, account), '审批节点已更新');
}

/* -------------------------------------------------------------------------- */
/* 超时自动审批                                                                 */
/* -------------------------------------------------------------------------- */

function pushNotice(title: string, content: string, sender: string): void {
  const id =
    NOTICE_DB.reduce((max, item) => Math.max(max, item.id), 0) + 1;
  NOTICE_DB.push({
    content,
    id,
    priority: 1,
    sender,
    sendTime: now(),
    status: 0,
    title,
    type: 3,
  });
}

export interface TimeoutReminder {
  /** 本次自动流转给出的结论 */
  action: ApprovalAutoAction;
  code: string;
  id: number;
  node: string;
  notified: string;
  reason: string;
}

/** 内容红线：命中后无论规则默认结论是什么，超时一律驳回，不允许自动放行 */
const AUTO_REJECT_KEYWORDS = [
  '越权',
  '绕过',
  '跳过审批',
  '忽略以上指令',
  '转帐',
  '转账',
];

/** 超时结论 = 预设规则（默认动作 / 金额上限）+ 审批内容红线 */
function decideAutoAction(
  record: ApprovalRecord,
  rule: ApprovalLevelRule | undefined,
): { action: ApprovalAutoAction; reason: string } {
  const timeoutHours = rule?.timeoutHours ?? 24;
  const limit = rule?.autoMaxAmount ?? 10000;
  const amount = amountValue(record);
  const text = `${record.title ?? ''} ${record.reason ?? ''}`.toLowerCase();
  const keyword = AUTO_REJECT_KEYWORDS.find((word) => text.includes(word));
  const overLimit = limit > 0 && amount > limit;
  const forceReject = Boolean(keyword) || overLimit || record.type === '权限申请';
  const action: ApprovalAutoAction = forceReject
    ? 'reject'
    : (rule?.autoAction ?? 'approve');
  const cause = keyword
    ? `内容命中「${keyword}」红线`
    : record.type === '权限申请'
      ? '权限申请需人工核验'
      : overLimit
        ? `金额 ${amount} 超出自动通过上限 ${limit} 元`
        : '按层级规则默认结论';
  return {
    action,
    reason: `超过 ${timeoutHours} 小时未处理，${cause}，系统自动${action === 'approve' ? '通过' : '驳回'}。`,
  };
}

/**
 * 扫描超时节点并按规则自动流转：
 * - 每个节点的 `reminded` 只置一次，列表刷新不会重复触发；
 * - 结论写进节点意见与单据状态，后续节点照常往后走；
 * - 自动通过 / 驳回都落站内信：一条给原审批人，一条给发起人。
 */
export function scanApprovalTimeouts(): TimeoutReminder[] {
  const reminders: TimeoutReminder[] = [];
  for (const record of APPROVAL_DB) {
    if (record.status !== 'pending') continue;
    ensureFlow(record);
    const current = currentApprovalNode(record);
    if (!current?.dueAt || current.reminded) continue;
    if (dayjs(current.dueAt).isAfter(dayjs())) continue;

    // 先标记再取回对象：applyNodeDecision 会整体替换 flowNodes 数组
    record.flowNodes = (record.flowNodes ?? []).map((node) =>
      node === current ? { ...node, reminded: true } : node,
    );
    const active = currentApprovalNode(record) ?? current;
    const { action, reason } = decideAutoAction(
      record,
      findLevelRule(record.applicant),
    );
    const message = applyNodeDecision(
      record,
      active,
      action,
      reason,
      active.approver || '审批系统',
      true,
    );
    const notified = active.approver || '超级管理员';
    const detail = `单据 ${record.code}「${record.title}」的「${active.title}」节点已超时，${reason}（${message}）`;
    pushNotice(`审批超时自动${action === 'approve' ? '通过' : '驳回'}：${record.title}`, detail, notified);
    pushNotice(`超时结果通知（申请人）：${record.title}`, detail, record.applicant);
    reminders.push({
      action,
      code: record.code,
      id: record.id,
      node: active.title,
      notified,
      reason,
    });
  }
  return reminders;
}
