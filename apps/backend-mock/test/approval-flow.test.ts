import type { TestEvent } from './fixtures/nitro-imports';

import { beforeEach, describe, expect, it } from 'vitest';

import groupDeleteRoute from '../server/api/approval/group/[id].delete';
import groupListRoute from '../server/api/approval/group/list.get';
import groupSaveRoute from '../server/api/approval/group/save.post';
import mineDeleteRoute from '../server/api/approval/mine/[id].delete';
import mineActionRoute from '../server/api/approval/mine/action.post';
import mineListRoute from '../server/api/approval/mine/list.get';
import mineSaveRoute from '../server/api/approval/mine/save.post';
import monitorListRoute from '../server/api/approval/monitor/list.get';
import monitorSummaryRoute from '../server/api/approval/monitor/summary.get';
import {
  APPROVAL_DB,
  APPROVAL_GROUP_DB,
  APPROVAL_INSTANCE_DB,
  summarizeApprovals,
  summarizeGroups,
  summarizeInstances,
} from '../server/utils/db/approval';
import { createTestEvent } from './fixtures/nitro-imports';

type Handler = (event: TestEvent) => Promise<{ code: number; data: any }>;
const as = (route: unknown) => route as Handler;

const mineList = as(mineListRoute);
const mineSave = as(mineSaveRoute);
const mineDelete = as(mineDeleteRoute);
const mineAction = as(mineActionRoute);
const groupList = as(groupListRoute);
const groupSave = as(groupSaveRoute);
const groupDelete = as(groupDeleteRoute);
const monitorList = as(monitorListRoute);
const monitorSummary = as(monitorSummaryRoute);

/** 模块加载时抓一份种子快照：用例会改状态/加删行，每条用例前完整还原 */
const seedApprovals = [...APPROVAL_DB].map((row) => ({ ...row }));
const seedGroups = [...APPROVAL_GROUP_DB].map((row) => ({ ...row }));
const seedInstances = [...APPROVAL_INSTANCE_DB].map((row) => ({ ...row }));

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

describe('审批流数据闭环', () => {
  beforeEach(() => {
    restore(APPROVAL_DB, seedApprovals);
    restore(APPROVAL_GROUP_DB, seedGroups);
    restore(APPROVAL_INSTANCE_DB, seedInstances);
  });

  it('种子数据彼此关联，且三张表数量固定', () => {
    expect(seedApprovals).toHaveLength(10);
    expect(seedGroups).toHaveLength(6);
    expect(seedInstances).toHaveLength(8);
    expect(APPROVAL_DB).toHaveLength(10);
    for (const approval of APPROVAL_DB) {
      expect(seedGroups.some((group) => group.id === approval.groupId)).toBe(
        true,
      );
    }
    for (const instance of APPROVAL_INSTANCE_DB) {
      expect(
        seedGroups.some((group) => group.name === instance.groupName),
      ).toBe(true);
    }
  });

  it('审批通过会写入意见并把单据改为 approved，统计同步', async () => {
    const res = await mineAction(
      createTestEvent({
        body: { id: 1, action: 'approve', reason: '票据齐全，同意' },
      }),
    );
    expect(res.code).toBe(200);
    expect(res.data.approval.status).toBe('approved');
    expect(res.data.approval.reason).toBe('票据齐全，同意');
    expect(APPROVAL_DB.find((row) => row.id === 1)!.status).toBe('approved');
    expect(res.data.stats.approved).toBe(4);
    expect(res.data.stats.approved).toBe(summarizeApprovals().approved);
  });

  it('审批驳回会写入意见并把单据改为 rejected', async () => {
    const res = await mineAction(
      createTestEvent({
        body: { id: 2, action: 'reject', reason: '缺少附件' },
      }),
    );
    expect(res.code).toBe(200);
    expect(res.data.approval.status).toBe('rejected');
    expect(res.data.approval.reason).toBe('缺少附件');
    expect(res.data.stats.rejected).toBe(3);
  });

  it('已完结单据不能再次审批，非法操作与空意见被拒', async () => {
    await mineAction(
      createTestEvent({ body: { id: 1, action: 'approve', reason: '同意' } }),
    );
    const again = await mineAction(
      createTestEvent({ body: { id: 1, action: 'reject', reason: '反悔' } }),
    );
    expect(again.code).toBe(409);

    const rejectedAgain = await mineAction(
      createTestEvent({ body: { id: 5, action: 'approve', reason: '再看看' } }),
    );
    expect(rejectedAgain.code).toBe(409);

    const badAction = await mineAction(
      createTestEvent({ body: { id: 2, action: 'archive', reason: '归档' } }),
    );
    expect(badAction.code).toBe(400);

    const emptyReason = await mineAction(
      createTestEvent({ body: { id: 2, action: 'approve', reason: '   ' } }),
    );
    expect(emptyReason.code).toBe(400);
  });

  it('不存在的 id 在审批 / 删除 / 编辑路径都返回业务错误', async () => {
    expect(
      (
        await mineAction(
          createTestEvent({
            body: { id: 999_999, action: 'approve', reason: 'x' },
          }),
        )
      ).code,
    ).toBe(404);
    expect(
      (await mineDelete(createTestEvent({ params: { id: '999999' } }))).code,
    ).toBe(404);
    expect(
      (await mineSave(createTestEvent({ body: { id: 999_999, title: 'x' } })))
        .code,
    ).toBe(404);
    expect(
      (await groupDelete(createTestEvent({ params: { id: '999999' } }))).code,
    ).toBe(404);
    expect(
      (await groupSave(createTestEvent({ body: { id: 999_999, name: 'x' } })))
        .code,
    ).toBe(404);
  });

  it('单据必填校验：title / type / applicant 缺一不可', async () => {
    expect(
      (
        await mineSave(
          createTestEvent({ body: { type: '采购', applicant: '甲' } }),
        )
      ).code,
    ).toBe(400);
    expect(
      (
        await mineSave(
          createTestEvent({ body: { title: '采购单', applicant: '甲' } }),
        )
      ).code,
    ).toBe(400);
    expect(
      (
        await mineSave(
          createTestEvent({ body: { title: '采购单', type: '采购' } }),
        )
      ).code,
    ).toBe(400);
  });

  it('单据新建 / 编辑 / 删除均持久化到同一份集合', async () => {
    const created = await mineSave(
      createTestEvent({
        body: {
          title: '验收单据',
          type: '采购',
          applicant: '测试员',
          amount: '¥ 100',
          groupId: 2,
        },
      }),
    );
    expect(created.code).toBe(200);
    const id = created.data.id as number;
    expect(typeof id).toBe('number');
    expect(APPROVAL_DB.find((row) => row.id === id)!.title).toBe('验收单据');

    const edited = await mineSave(
      createTestEvent({ body: { id, title: '验收单据（改）' } }),
    );
    expect(edited.code).toBe(200);
    expect(APPROVAL_DB.find((row) => row.id === id)!.title).toBe(
      '验收单据（改）',
    );

    const removed = await mineDelete(
      createTestEvent({ params: { id: String(id) } }),
    );
    expect(removed.code).toBe(200);
    expect(APPROVAL_DB.find((row) => row.id === id)).toBeUndefined();
  });

  it('单据列表按 pageNum / pageSize 切片，total 为筛选后总量', async () => {
    const page1 = (
      await mineList(
        createTestEvent({ query: { pageNum: '1', pageSize: '3' } }),
      )
    ).data;
    expect(page1.list).toHaveLength(3);
    expect(page1.total).toBe(10);
    const page4 = (
      await mineList(
        createTestEvent({ query: { pageNum: '4', pageSize: '3' } }),
      )
    ).data;
    expect(page4.list).toHaveLength(1);
    const all = (await mineList(createTestEvent())).data;
    expect(all.list).toHaveLength(10);
    expect(all.stats.total).toBe(10);
  });

  it('单据列表支持 status / keyword / mine 视角筛选', async () => {
    const approved = (
      await mineList(createTestEvent({ query: { status: 'approved' } }))
    ).data;
    expect(approved.total).toBe(3);
    expect(approved.list.every((row: any) => row.status === 'approved')).toBe(
      true,
    );

    const keyword = (
      await mineList(createTestEvent({ query: { keyword: '差旅' } }))
    ).data;
    expect(keyword.total).toBe(1);
    expect(keyword.list[0].code).toBe('AP-8801');

    const initiated = (
      await mineList(createTestEvent({ query: { mine: 'initiated' } }))
    ).data;
    expect(initiated.total).toBe(2);
    expect(initiated.list.every((row: any) => row.applicant === '王一')).toBe(
      true,
    );

    const pending = (
      await mineList(createTestEvent({ query: { mine: 'pending' } }))
    ).data;
    expect(pending.total).toBe(2);
    expect(
      pending.list.every(
        (row: any) => row.status === 'pending' && row.approver === '周珂',
      ),
    ).toBe(true);

    const empty = (
      await mineList(createTestEvent({ query: { status: 'not-exist' } }))
    ).data;
    expect(empty.total).toBe(0);
    expect(empty.list).toEqual([]);
  });

  it('分组统计与状态筛选一致，必填校验生效', async () => {
    expect(summarizeGroups()).toEqual({
      disabled: 1,
      enabled: 5,
      processCount: 29,
      total: 6,
    });
    const listed = (
      await groupList(createTestEvent({ query: { status: 'disabled' } }))
    ).data;
    expect(listed.total).toBe(1);
    expect(listed.list[0].name).toBe('历史归档');
    expect(
      (await groupSave(createTestEvent({ body: { owner: '甲' } }))).code,
    ).toBe(400);
    expect(
      (await groupSave(createTestEvent({ body: { name: '分组' } }))).code,
    ).toBe(400);
  });

  it('分组 CRUD 与启停持久化', async () => {
    const created = await groupSave(
      createTestEvent({
        body: { name: '临时分组', owner: '测试员', description: '内测' },
      }),
    );
    expect(created.code).toBe(200);
    const id = created.data.id as number;
    expect(APPROVAL_GROUP_DB.find((row) => row.id === id)!.status).toBe(
      'enabled',
    );

    // 只回传 id + status 即可启停，其余字段保留
    const stopped = await groupSave(
      createTestEvent({ body: { id, status: 'disabled' } }),
    );
    expect(stopped.code).toBe(200);
    expect(APPROVAL_GROUP_DB.find((row) => row.id === id)).toMatchObject({
      name: '临时分组',
      owner: '测试员',
      status: 'disabled',
    });

    expect(
      (await groupDelete(createTestEvent({ params: { id: String(id) } }))).code,
    ).toBe(200);
    expect(APPROVAL_GROUP_DB.find((row) => row.id === id)).toBeUndefined();
  });

  it('监控统计包含运行中 / 今日完结 / 平均耗时 / 异常', async () => {
    const summary = (await monitorSummary(createTestEvent())).data;
    expect(summary).toEqual({
      avgDurationHours: 3.2,
      done: 2,
      doneToday: 2,
      error: 2,
      running: 4,
      total: 8,
    });
    expect(summarizeInstances()).toEqual(summary);
  });

  it('实例列表分页、status 与 keyword 筛选均可用', async () => {
    const page = (
      await monitorList(
        createTestEvent({ query: { pageNum: '1', pageSize: '3' } }),
      )
    ).data;
    expect(page.list).toHaveLength(3);
    expect(page.total).toBe(8);
    expect(page.stats.running).toBe(4);

    const errors = (
      await monitorList(createTestEvent({ query: { status: 'error' } }))
    ).data;
    expect(errors.total).toBe(2);
    expect(errors.list.every((row: any) => row.status === 'error')).toBe(true);

    const keyword = (
      await monitorList(createTestEvent({ query: { keyword: '采购' } }))
    ).data;
    expect(keyword.total).toBe(1);
    expect(keyword.list[0].code).toBe('IN-3103');
  });
});
