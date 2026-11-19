/**
 * 透明集合 + 重启持久化测试（SQLITE_MIGRATION_PLAN.md 1.4）。
 *
 * 验证「handler 零改动」的前提：现有代码对 `*_DB` 做的每一种读写
 * （展开 / find / 索引赋值 / push / splice / 行属性赋值 / 嵌套数组 push）
 * 在 SQLite 实现下都能正确落库，且重启后数据仍在。
 */

import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { closeDb } from '../server/utils/db/sqlite/connection';
import { resetStoreForTest } from '../server/utils/db/sqlite';

import type { RoleItem } from '../server/utils/db/role';

let workDir: string;
let dbFile: string;
let ROLE_DB: RoleItem[];
let nextRoleId: () => number;

async function loadFresh(): Promise<void> {
  closeDb();
  resetStoreForTest();
  vi.resetModules();
  const role = await import('../server/utils/db/role');
  ROLE_DB = role.ROLE_DB;
  nextRoleId = role.nextRoleId;
}

beforeEach(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'antdv-mock-db-'));
  dbFile = join(workDir, 'mock.sqlite');
  process.env.MOCK_DB_FILE = dbFile;
  await loadFresh();
});

afterEach(() => {
  closeDb();
  resetStoreForTest();
  delete process.env.MOCK_DB_FILE;
  if (existsSync(workDir)) rmSync(workDir, { force: true, recursive: true });
});

describe('defineCollection · 种子与数组语义', () => {
  it('首次加载灌入固定种子，且 Array.isArray 仍为 true', () => {
    expect(Array.isArray(ROLE_DB)).toBe(true);
    expect(ROLE_DB.length).toBe(6);
    expect([...ROLE_DB].map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(ROLE_DB.find((r) => r.code === 'super_admin')?.name).toBe('超级管理员');
    expect(ROLE_DB.filter((r) => r.status === 1)).toHaveLength(5);
    expect(ROLE_DB[0]?.menuIds).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('Object.keys 只暴露业务字段，不泄漏内部列', () => {
    const keys = Object.keys(ROLE_DB[0]!);
    expect(keys).toContain('id');
    expect(keys).not.toContain('_pk');
    expect(keys).not.toContain('deleted');
    expect(keys).not.toContain('data');
    expect(keys).not.toContain('created_at');
  });

  it('JSON 序列化与旧数组一致（响应信封形态不变）', () => {
    const json = JSON.parse(JSON.stringify([...ROLE_DB])) as RoleItem[];
    expect(json[0]).toMatchObject({
      id: 1,
      name: '超级管理员',
      code: 'super_admin',
      menuIds: [1, 2, 3, 4, 5, 6, 7, 8],
    });
  });
});

describe('defineCollection · 写操作落库', () => {
  it('push 新增并回写业务 id（handler 的 success(newRole) 拿到正确 id）', async () => {
    const newRole = {
      id: nextRoleId(),
      name: '测试角色',
      code: 'test',
      description: '',
      sort: 9,
      status: 1,
      menuIds: [],
      createdAt: '2026-11-14 20:00:00',
    } satisfies RoleItem;
    ROLE_DB.push(newRole);

    expect(newRole.id).toBe(7);
    expect(ROLE_DB.length).toBe(7);
    expect(ROLE_DB.find((r) => r.code === 'test')?.name).toBe('测试角色');

    // 重新加载模块 = 模拟进程重启，新增记录仍在
    await loadFresh();
    expect(ROLE_DB.length).toBe(7);
    expect(ROLE_DB.find((r) => r.code === 'test')?.id).toBe(7);
    expect(nextRoleId()).toBe(8); // 不再从 7 撞号
  });

  it('索引赋值更新落库（handler 的 DB[idx] = {...DB[idx], ...patch}）', async () => {
    const idx = ROLE_DB.findIndex((r) => r.id === 2);
    ROLE_DB[idx] = { ...ROLE_DB[idx]!, name: '管理员（已改名）' };
    expect(ROLE_DB[idx]?.name).toBe('管理员（已改名）');

    await loadFresh();
    expect(ROLE_DB.find((r) => r.id === 2)?.name).toBe('管理员（已改名）');
    expect(ROLE_DB.find((r) => r.id === 2)?.code).toBe('admin');
  });

  it('splice 是软删除：列表不可见，重启后不复活', async () => {
    const idx = ROLE_DB.findIndex((r) => r.id === 4);
    ROLE_DB.splice(idx, 1);
    expect(ROLE_DB.length).toBe(5);
    expect(ROLE_DB.find((r) => r.id === 4)).toBeUndefined();

    await loadFresh();
    expect(ROLE_DB.length).toBe(5);
    expect(ROLE_DB.find((r) => r.id === 4)).toBeUndefined();

    const { getStore } = await import('../server/utils/db/sqlite');
    expect(getStore().list('tb_role', { includeDeleted: true }).total).toBe(6);
  });

  it('行对象属性直改落库（handler 的 notice.status = 1 写法）', async () => {
    const role = ROLE_DB.find((r) => r.id === 3)!;
    role.status = 0;
    role.description = '就地修改';
    await loadFresh();
    expect(ROLE_DB.find((r) => r.id === 3)).toMatchObject({
      status: 0,
      description: '就地修改',
    });
  });

  it('嵌套数组 push 落库（handler 的 dictType.items.push 写法）', async () => {
    const role = ROLE_DB.find((r) => r.id === 1)!;
    role.menuIds.push(99);
    await loadFresh();
    expect(ROLE_DB.find((r) => r.id === 1)?.menuIds).toContain(99);
  });
});

describe('生产环境：只建表不播种', () => {
  it('MOCK_ENV=production 时集合为空，且库文件被创建', async () => {
    process.env.MOCK_ENV = 'production';
    try {
      // 清掉 beforeEach 的库，模拟生产环境首次启动
      closeDb();
      rmSync(workDir, { force: true, recursive: true });
      await loadFresh();
      expect(Array.isArray(ROLE_DB)).toBe(true);
      expect(ROLE_DB.length).toBe(0);
      expect(nextRoleId()).toBe(1);
      // 生产仍走 SQLite：库文件由 getDb() 建好，只是没有种子行
      expect(existsSync(dbFile)).toBe(true);
      const { getStore } = await import('../server/utils/db/sqlite');
      expect(getStore().list('tb_role').total).toBe(0);
    } finally {
      delete process.env.MOCK_ENV;
    }
  });
});
