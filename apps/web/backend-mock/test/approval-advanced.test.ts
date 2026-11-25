import type { MockAccount } from '../server/utils/accounts';
import type { ApprovalLevelRule } from '../server/utils/approval-advanced';
import type { ApprovalRecord } from '../server/utils/db/approval';
import type { TestEvent } from './fixtures/nitro-imports';

import dayjs from 'dayjs';
import { beforeEach, describe, expect, it } from 'vitest';

import levelDeleteRoute from '../server/api/approval/level/[id].delete';
import levelListRoute from '../server/api/approval/level/list.get';
import levelSaveRoute from '../server/api/approval/level/save.post';
import detailRoute from '../server/api/approval/mine/[id].get';
import actionRoute from '../server/api/approval/mine/action.post';
import extendRoute from '../server/api/approval/mine/extend.post';
import listRoute from '../server/api/approval/mine/list.get';
import resubmitRoute from '../server/api/approval/mine/resubmit.post';
import mineSaveRoute from '../server/api/approval/mine/save.post';
import scanRoute from '../server/api/approval/timeout/scan.post';
import { accounts, issueToken } from '../server/utils/accounts';
import {
  APPROVAL_LEVEL_DB,
  ensureFlow,
  scanApprovalTimeouts,
} from '../server/utils/approval-advanced';
import { APPROVAL_DB } from '../server/utils/db/approval';
import { NOTICE_DB } from '../server/utils/db/notice';
import { createTestEvent } from './fixtures/nitro-imports';

type Handler = (
  event: TestEvent,
) => Promise<{ code: number; data: any; message: string }>;
const as = (route: unknown) => route as Handler;

const action = as(actionRoute);
const list = as(listRoute);
const save = as(mineSaveRoute);
const detail = as(detailRoute);
const extend = as(extendRoute);
const scan = as(scanRoute);
const resubmit = as(resubmitRoute);
const levelList = as(levelListRoute);
const levelSave = as(levelSaveRoute);
const levelDelete = as(levelDeleteRoute);

const ADMIN = accounts.find((item) => item.profile.username === 'admin')!;
const CUSTOM = accounts.find((item) => item.profile.username === 'custom')!;
const STAFF = accounts.find((item) => item.profile.username === 'staff')!;

function event(
  account: MockAccount,
  init: Record<string, unknown> = {},
): TestEvent {
  return createTestEvent({
    ...init,
    headers: { authorization: `Bearer ${issueToken(account)}` },
  });
}

const seedApprovals = [...APPROVAL_DB].map((row) => ({ ...row }));
const seedLevels = [...APPROVAL_LEVEL_DB].map((row) => ({ ...row }));
const seedNotices = [...NOTICE_DB].map((row) => ({ ...row }));

function restore<T extends { id: number }>(db: T[], seeds: T[]): void {
  const seedIds = new Set(seeds.map((row) => row.id));
  [...db.keys()]
    .filter((key) => !seedIds.has(db[key]!.id))
    .reverse()
    .forEach((key) => db.splice(key, 1));
  seeds.forEach((seed, index) => {
    db[index] = { ...seed };
  });
}

beforeEach(() => {
  restore(APPROVAL_DB, seedApprovals);
  // 快照是浅拷贝，别的测试文件可能已经给单据补过节点/提醒标记；这里显式清掉，
  // 保证每条用例都从「旧数据首次读取」的状态开始。
  for (const row of APPROVAL_DB) {
    row.currentRound = undefined;
    row.currentStep = undefined;
    row.dueAt = '';
    row.flowNodes = undefined;
  }
  restore(APPROVAL_LEVEL_DB, seedLevels);
  restore(NOTICE_DB, seedNotices);
});

describe('审批多级权限', () => {
  it('直接上级可审批，普通员工不能审批别人发起的单据，超管可审批全部', async () => {
    // AP-8801：王一发起，规则指定的直接上级是周珂（custom 账号）
    const byLeader = await action(
      event(CUSTOM, {
        body: { id: 1, action: 'approve', reason: '预算内，同意' },
      }),
    );
    expect(byLeader.code).toBe(200);
    expect(byLeader.data.approval.status).toBe('approved');

    const byStaff = await action(
      event(STAFF, { body: { id: 1, action: 'approve', reason: '越权审批' } }),
    );
    expect(byStaff.code).toBe(403);
    expect(byStaff.data).toBeNull();

    // AP-8802：李珊发起，上级是林晓；超管不受层级限制
    const byAdmin = await action(
      event(ADMIN, { body: { id: 2, action: 'approve', reason: '超管特批' } }),
    );
    expect(byAdmin.code).toBe(200);
  });

  it('列表按账号返回审批身份与权限标记', async () => {
    const res = await list(event(STAFF, { query: {} }));
    expect(res.data.context.isSuperAdmin).toBe(false);
    expect(res.data.context.applicant).toBe('李珊');
    const ap8801 = res.data.list.find((row: ApprovalRecord) => row.id === 1);
    expect(ap8801.canApprove).toBe(false);
    expect(ap8801.currentNode).toBeTruthy();
  });
});

describe('多级节点流转', () => {
  it('大额单据在直属上级之后流转到上级复核，全部通过后才归档', async () => {
    const created = await save(
      event(CUSTOM, {
        body: {
          title: '大额采购复核',
          type: '采购',
          applicant: '王一',
          amount: '¥ 18,600',
        },
      }),
    );
    expect(created.code).toBe(200);
    const id = created.data.id as number;
    const nodes = created.data.flowNodes as Array<{
      title: string;
      status: string;
    }>;
    expect(nodes.map((node) => node.title)).toContain('直属上级审批');
    expect(nodes.map((node) => node.title)).toContain('上级复核（金额阈值）');

    const first = await action(
      event(CUSTOM, { body: { id, action: 'approve', reason: '同意采购' } }),
    );
    expect(first.code).toBe(200);
    expect(first.data.approval.status).toBe('pending');
    expect(first.data.approval.currentNode).toBe('上级复核（金额阈值）');

    const second = await action(
      event(ADMIN, { body: { id, action: 'approve', reason: '复核通过' } }),
    );
    expect(second.code).toBe(200);
    expect(second.data.approval.status).toBe('approved');
  });

  it('追加审批人支持会签：同组一人通过不停流转，全部通过才完结', async () => {
    const created = await save(
      event(CUSTOM, {
        body: {
          title: '会签示例',
          type: '请假',
          applicant: '王一',
          amount: '1 天',
        },
      }),
    );
    const id = created.data.id as number;
    const added = await extend(
      event(CUSTOM, {
        body: {
          id,
          additionalApprovers: ['陈默', '苏叶'],
          ccPersons: ['林晓'],
          signMode: 'countersign',
        },
      }),
    );
    expect(added.code).toBe(200);
    const nodes = added.data.flowNodes as Array<{ step: number; kind: string }>;
    const extra = nodes.filter(
      (node) => node.kind === 'approval' && node.step === 3,
    );
    expect(extra).toHaveLength(2);
    expect(added.data.ccPersons).toContain('林晓');

    const first = await action(
      event(CUSTOM, { body: { id, action: 'approve', reason: '上级同意' } }),
    );
    expect(first.code).toBe(200);
    expect(first.data.approval.status).toBe('pending');

    const second = await action(
      event(ADMIN, { body: { id, action: 'approve', reason: '会签同意' } }),
    );
    expect(second.code).toBe(200);
    expect(second.data.approval.status).toBe('pending');

    const third = await action(
      event(ADMIN, { body: { id, action: 'approve', reason: '会签同意' } }),
    );
    expect(third.code).toBe(200);
    expect(third.data.approval.status).toBe('approved');
  });

  it('非审批人不能追加节点，空输入与把自己追加为审批人都被拒绝', async () => {
    const created = await save(
      event(CUSTOM, {
        body: { title: '边界校验', type: '采购', applicant: '王一' },
      }),
    );
    const id = created.data.id as number;

    expect(
      (await extend(event(STAFF, { body: { id, ccPersons: ['林晓'] } }))).code,
    ).toBe(403);
    expect(
      (await extend(event(CUSTOM, { body: { id, ccPersons: [] } }))).code,
    ).toBe(400);
    expect(
      (
        await extend(
          event(CUSTOM, { body: { id, additionalApprovers: ['王一'] } }),
        )
      ).code,
    ).toBe(400);
  });
});

describe('详情与编辑权限', () => {
  it('详情返回节点且不携带 AI 研判字段', async () => {
    const res = await detail(event(ADMIN, { params: { id: '1' } }));
    expect(res.code).toBe(200);
    expect(res.data.flowNodes.length).toBeGreaterThan(1);
    expect(res.data.aiAssessment).toBeUndefined();
  });

  it('只有发起人能编辑自己的审批单据', async () => {
    // AP-8802 由李珊发起（staff 账号）
    const byOther = await save(
      event(ADMIN, { body: { id: 2, title: '越权改单' } }),
    );
    expect(byOther.code).toBe(403);
    const byOwner = await save(
      event(STAFF, { body: { id: 2, title: '本人改单' } }),
    );
    expect(byOwner.code).toBe(200);
    expect(APPROVAL_DB.find((row) => row.id === 2)!.title).toBe('本人改单');
  });
});

describe('超时自动审批', () => {
  it('常规单据超时后按规则自动通过并流转到归档', async () => {
    const target = APPROVAL_DB.find((item) => item.id === 1)!;
    ensureFlow(target);
    const past = dayjs().subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss');
    target.flowNodes = (target.flowNodes ?? []).map((node) =>
      node.kind === 'approval' && node.status === 'current'
        ? { ...node, dueAt: past }
        : node,
    );

    const before = NOTICE_DB.length;
    const result = scanApprovalTimeouts();
    const mine = result.find((item) => item.code === target.code);
    expect(mine?.action).toBe('approve');
    expect(mine?.notified).toBe('周珂');
    // 集合每次读取都返回新快照，校验结果要从库里重新取
    const updated = APPROVAL_DB.find((row) => row.id === 1)!;
    expect(updated.status).toBe('approved');
    const approvalNode = updated.flowNodes!.find(
      (node) => node.kind === 'approval',
    );
    expect(approvalNode?.auto).toBe(true);
    expect(approvalNode?.comment).toContain('系统自动通过');
    expect(NOTICE_DB.length).toBe(before + result.length * 2);
    expect(NOTICE_DB.some((item) => item.title.includes('超时自动通过'))).toBe(
      true,
    );

    // 同一节点不会重复触发
    expect(scanApprovalTimeouts()).toHaveLength(0);
    expect(NOTICE_DB.length).toBe(before + result.length * 2);
    expect((await scan(event(STAFF))).code).toBe(403);
    expect((await scan(event(ADMIN))).code).toBe(200);
  });

  it('金额超限与内容红线命中时超时自动驳回', async () => {
    const created = await save(
      event(ADMIN, {
        body: {
          title: '越权访问申请',
          type: '费用报销',
          applicant: '王一',
          amount: '¥ 20,000',
        },
      }),
    );
    expect(created.code).toBe(200);
    const target = APPROVAL_DB.find((row) => row.id === created.data.id)!;
    ensureFlow(target);
    const past = dayjs().subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss');
    target.flowNodes = (target.flowNodes ?? []).map((node) =>
      node.kind === 'approval' && node.status === 'current'
        ? { ...node, dueAt: past }
        : node,
    );

    const result = scanApprovalTimeouts();
    const mine = result.find((item) => item.code === target.code);
    expect(mine?.action).toBe('reject');
    const updated = APPROVAL_DB.find((row) => row.id === created.data.id)!;
    expect(updated.status).toBe('rejected');
    expect(updated.flowNodes!.some((node) => node.status === 'skipped')).toBe(
      true,
    );
  });
});

describe('驳回重提', () => {
  it('发起人在原流程后追加新一轮，历史节点保持不变', async () => {
    // AP-8808 是王一发起的已驳回单据
    const before = APPROVAL_DB.find((row) => row.id === 8)!;
    ensureFlow(before);
    const history = JSON.parse(JSON.stringify(before.flowNodes));

    const res = await resubmit(
      event(ADMIN, { body: { id: 8, reason: '已补充权限说明' } }),
    );
    expect(res.code).toBe(200);
    expect(res.data.approval.status).toBe('pending');
    expect(res.data.approval.currentRound).toBe(2);
    const nodes = res.data.approval.flowNodes as Array<{
      round: number;
      status: string;
      title: string;
    }>;
    expect(nodes).toHaveLength(history.length * 2);
    expect(nodes.slice(0, history.length)).toEqual(history);
    expect(nodes.filter((node) => node.round === 2)).toHaveLength(
      history.length,
    );
    expect(
      nodes.some((node) => node.round === 2 && node.status === 'current'),
    ).toBe(true);
  });

  it('非发起人和未驳回的单据都不能重提', async () => {
    expect((await resubmit(event(STAFF, { body: { id: 8 } }))).code).toBe(403);
    expect((await resubmit(event(ADMIN, { body: { id: 1 } }))).code).toBe(409);
  });
});

describe('层级规则配置', () => {
  it('超管可增删改，普通账号只读且重复员工被拒绝', async () => {
    const list = await levelList(event(STAFF));
    expect(list.code).toBe(200);
    expect(list.data.list.length).toBeGreaterThan(0);

    const created = await levelSave(
      event(ADMIN, {
        body: {
          employee: '新同事',
          leader: '王一',
          level: 1,
          timeoutHours: 8,
          enabled: 'enabled',
        },
      }),
    );
    expect(created.code).toBe(200);
    const id = created.data.id as number;

    expect(
      (
        await levelSave(
          event(CUSTOM, { body: { employee: '甲', leader: '乙' } }),
        )
      ).code,
    ).toBe(403);
    expect(
      (
        await levelSave(
          event(ADMIN, { body: { employee: '新同事', leader: '周珂' } }),
        )
      ).code,
    ).toBe(409);
    expect(
      (
        await levelSave(
          event(ADMIN, { body: { employee: '甲', leader: '甲' } }),
        )
      ).code,
    ).toBe(400);

    expect(
      (await levelDelete(event(CUSTOM, { params: { id: String(id) } }))).code,
    ).toBe(403);
    expect(
      (await levelDelete(event(ADMIN, { params: { id: String(id) } }))).code,
    ).toBe(200);
    expect(
      APPROVAL_LEVEL_DB.some((rule: ApprovalLevelRule) => rule.id === id),
    ).toBe(false);
  });
});
