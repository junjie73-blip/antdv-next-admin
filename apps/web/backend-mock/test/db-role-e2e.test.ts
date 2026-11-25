/**
 * role 域端到端契约测试：**四个真实 handler 一行未改**，直接调用其默认导出，
 * 验证响应信封 / 分页字段 / CRUD 往返 / 软删除 / 重启持久化全部等价。
 *
 * 这是 SQLITE_MIGRATION_PLAN.md 1.4「集成」与「重启后数据持久化」用例的落地。
 */

import type { RoleItem } from '../server/utils/db/role';
import type { TestEvent } from './fixtures/nitro-imports';

import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetStoreForTest } from '../server/utils/db/sqlite';
import { closeDb } from '../server/utils/db/sqlite/connection';
import { createTestEvent } from './fixtures/nitro-imports';

interface Envelope<T> {
  code: number;
  data: T;
  message: string;
}

interface ListData {
  list: RoleItem[];
  total: number;
}

type RouteHandler = (event: TestEvent) => Promise<unknown>;

let workDir: string;
let handlers: {
  list: RouteHandler;
  create: RouteHandler;
  update: RouteHandler;
  remove: RouteHandler;
  record: RouteHandler;
};

async function loadFresh(): Promise<void> {
  closeDb();
  resetStoreForTest();
  vi.resetModules();
  const [list, create, update, remove, record] = await Promise.all([
    import('../server/api/system/role/list.get'),
    import('../server/api/system/role/index.post'),
    import('../server/api/system/role/[id].put'),
    import('../server/api/system/role/[id].delete'),
    import('../server/api/system/record/[module]/[id].get'),
  ]);
  handlers = {
    create: create.default as unknown as RouteHandler,
    list: list.default as unknown as RouteHandler,
    record: record.default as unknown as RouteHandler,
    remove: remove.default as unknown as RouteHandler,
    update: update.default as unknown as RouteHandler,
  };
}

function event(init: {
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, string>;
}): TestEvent {
  return createTestEvent(init);
}

async function getList(
  query: Record<string, string> = {},
): Promise<Envelope<ListData>> {
  return (await handlers.list(event({ query }))) as Envelope<ListData>;
}

beforeEach(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'antdv-mock-e2e-'));
  process.env.MOCK_DB_FILE = join(workDir, 'mock.sqlite');
  await loadFresh();
});

afterEach(() => {
  // Windows 上 SQLite 句柄未关时删库会 EBUSY，必须先关连接再删临时目录
  closeDb();
  resetStoreForTest();
  delete process.env.MOCK_DB_FILE;
  if (existsSync(workDir)) rmSync(workDir, { force: true, recursive: true });
});

describe('role 域 · 响应信封与分页契约', () => {
  it('gET list 返回 code=200 与 { list, total }，无参时全量', async () => {
    const res = await getList();
    expect(res.code).toBe(200);
    expect(res.message).toBe('获取角色列表成功');
    expect(res.data.total).toBe(6);
    expect(res.data.list.map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('pageNum/pageSize 生效，total 恒为筛选后总量', async () => {
    const page1 = await getList({ pageNum: '1', pageSize: '2' });
    const page2 = await getList({ pageNum: '2', pageSize: '2' });
    expect(page1.data.total).toBe(6);
    expect(page1.data.list.map((r) => r.id)).toEqual([1, 2]);
    expect(page2.data.list.map((r) => r.id)).toEqual([3, 4]);
    expect(
      new Set([...page1.data.list, ...page2.data.list].map((r) => r.id)).size,
    ).toBe(4);
  });

  it('keyword 模糊与 status 精确筛选语义不变', async () => {
    const byKeyword = await getList({ keyword: '管理' });
    expect(byKeyword.data.total).toBe(2);
    const byStatus = await getList({ status: '0' });
    expect(byStatus.data.total).toBe(1);
    expect(byStatus.data.list[0]?.code).toBe('guest');
  });
});

describe('role 域 · CRUD 往返与持久化', () => {
  it('pOST 新增 -> PUT 改名 -> DELETE 删除，全流程落库', async () => {
    const created = (await handlers.create(
      event({
        body: {
          name: '测试角色',
          code: 'tester',
          description: 'e2e',
          sort: 8,
          status: 1,
        },
      }),
    )) as Envelope<RoleItem>;
    expect(created.code).toBe(200);
    expect(created.data.id).toBe(7);
    expect(created.data.name).toBe('测试角色');

    expect((await getList()).data.total).toBe(7);

    const updated = (await handlers.update(
      event({ params: { id: '7' }, body: { name: '测试角色（改）' } }),
    )) as Envelope<RoleItem>;
    expect(updated.code).toBe(200);
    expect(updated.data.name).toBe('测试角色（改）');
    expect(updated.data.code).toBe('tester');

    const deleted = (await handlers.remove(
      event({ params: { id: '7' } }),
    )) as Envelope<null>;
    expect(deleted.code).toBe(200);
    expect((await getList()).data.total).toBe(6);
  });

  it('删除是软删除：列表不可见、includeDeleted 可见', async () => {
    await handlers.remove(event({ params: { id: '3' } }));
    expect((await getList()).data.list.some((r) => r.id === 3)).toBe(false);
    const { getStore } = await import('../server/utils/db/sqlite');
    const all = getStore().list<RoleItem>('tb_role', { includeDeleted: true });
    expect(all.total).toBe(6);
    expect(all.list.find((r) => r.id === 3)?.code).toBe('user');
  });

  it('超级管理员保护逻辑不变', async () => {
    const res = (await handlers.remove(
      event({ params: { id: '1' } }),
    )) as Envelope<null>;
    expect(res.code).toBe(400);
    expect(res.message).toBe('超级管理员角色不允许删除');
    expect((await getList()).data.total).toBe(6);
  });

  it('重启后：新增记录仍在、已删记录未复活（迁移核心收益）', async () => {
    await handlers.create(
      event({ body: { name: '持久化角色', code: 'persist', status: 1 } }),
    );
    await handlers.remove(event({ params: { id: '5' } }));

    await loadFresh(); // 模拟进程重启：关连接 + 丢单例 + 重新求值模块

    const res = await getList();
    expect(res.data.total).toBe(6); // 6 种子 - 1 删除 + 1 新增
    expect(res.data.list.some((r) => r.code === 'persist')).toBe(true);
    expect(res.data.list.some((r) => r.id === 5)).toBe(false);

    // 重启后新增 id 不撞号
    const again = (await handlers.create(
      event({ body: { name: '重启后新增', code: 'after_restart', status: 1 } }),
    )) as Envelope<RoleItem>;
    expect(again.data.id).toBe(8);
    expect((await getList()).data.total).toBe(7);
  });
});

describe('role 域 · 通用记录详情（前端契约）', () => {
  it('详情返回完整业务字段，不泄漏 SQLite 内部列', async () => {
    const res = (await handlers.record(
      event({ params: { module: 'role', id: '1' } }),
    )) as Envelope<{
      record: Record<string, unknown>;
      sections: Array<{ fields: Array<{ key: string }>; title: string }>;
    }>;
    expect(res.code).toBe(200);
    expect(res.data.record.name).toBe('超级管理员');
    const full = res.data.sections.find((s) => s.title === '完整记录');
    expect(full).toBeDefined();
    const keys = full!.fields.map((f) => f.key);
    expect(keys).toContain('menuIds');
    expect(keys).not.toContain('_pk');
    expect(keys).not.toContain('deleted');
    expect(keys).not.toContain('data');
    expect(keys).not.toContain('biz_id');
  });
});
