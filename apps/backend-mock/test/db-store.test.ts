/**
 * DataStore 双实现等价测试（SQLITE_MIGRATION_PLAN.md 1.4）。
 *
 * 同一组断言分别跑 MemoryStore 与 SqliteStore，防止实现漂移：
 * CRUD / 分页 / 软删除 / 恢复 / 关联表 / cuid 主键 / 无物理 DELETE。
 */

import { afterEach, describe, expect, it } from 'vitest';

import { closeDb, getDb, resetDbForTest } from '../server/utils/db/sqlite/connection';
import { genId } from '../server/utils/db/sqlite/ids';
import { MemoryStore, SqliteStore } from '../server/utils/db/sqlite/store';

import type { DataStore, Row } from '../server/utils/db/sqlite/store';

interface DemoRow extends Row {
  id: number;
  name: string;
  status: number;
}

function seedRows(store: DataStore, count = 12): void {
  for (let i = 1; i <= count; i++) {
    store.insert('tb_role', { id: i, name: `角色-${i}`, status: i % 2 });
  }
}

function makeSqlite(): SqliteStore {
  resetDbForTest(':memory:');
  return new SqliteStore(getDb());
}

afterEach(() => {
  closeDb();
  delete process.env.MOCK_DB_FILE;
});

const IMPLEMENTATIONS: Array<[string, () => DataStore]> = [
  ['MemoryStore', () => new MemoryStore()],
  ['SqliteStore', makeSqlite],
];

for (const [name, make] of IMPLEMENTATIONS) {
  describe(`${name} · CRUD 与分页契约`, () => {
    it('insert 生成 cuid 物理主键、保留 number 业务 id', () => {
      const store = make();
      const row: DemoRow = { id: 1, name: '管理员', status: 1 };
      const pk = store.insert('tb_role', row);
      expect(typeof pk).toBe('string');
      expect(pk.length).toBeGreaterThan(12);
      expect(Number.isNaN(Number(pk))).toBe(true); // cuid 不是数字
      expect(row.id).toBe(1);
      expect(store.getById<DemoRow>('tb_role', 1)).toEqual(row);
    });

    it('id 缺省时按库内 max+1 分配，重启也不会撞号', () => {
      const store = make();
      const a = { name: 'A', status: 1 } as DemoRow;
      const b = { name: 'B', status: 1 } as DemoRow;
      store.insert('tb_role', a);
      store.insert('tb_role', b);
      expect(a.id).toBe(1);
      expect(b.id).toBe(2);
      const c = { name: 'C', status: 1 } as DemoRow;
      store.insert('tb_role', c);
      expect(c.id).toBe(3);
    });

    it('list 返回 { list, total }，total 恒为筛选后总量', () => {
      const store = make();
      seedRows(store);
      const all = store.list<DemoRow>('tb_role');
      expect(all.total).toBe(12);
      expect(all.list).toHaveLength(12);

      const paged = store.list<DemoRow>('tb_role', { pageNum: 2, pageSize: 5 });
      expect(paged.total).toBe(12);
      expect(paged.list.map((r) => r.id)).toEqual([6, 7, 8, 9, 10]);

      const filtered = store.list<DemoRow>('tb_role', {
        pageNum: 1,
        pageSize: 3,
        where: { status: 0 },
      });
      expect(filtered.total).toBe(6);
      expect(filtered.list).toHaveLength(3);
      expect(filtered.list.every((r) => r.status === 0)).toBe(true);
    });

    it('update 是局部合并，不丢字段', () => {
      const store = make();
      seedRows(store, 2);
      expect(store.update('tb_role', 1, { name: '改名' })).toBe(true);
      expect(store.getById<DemoRow>('tb_role', 1)).toMatchObject({
        id: 1,
        name: '改名',
        status: 1,
      });
      expect(store.update('tb_role', 999, { name: 'x' })).toBe(false);
    });

    it('list 返回浅拷贝，就地修改不会绕过仓储', () => {
      const store = make();
      seedRows(store, 1);
      const row = store.list<DemoRow>('tb_role').list[0]!;
      row.name = '脏写';
      expect(store.getById<DemoRow>('tb_role', 1)?.name).toBe('角色-1');
    });
  });

  describe(`${name} · 软删除规范`, () => {
    it('remove 后 list/getById 不可见，但 includeDeleted 可见', () => {
      const store = make();
      seedRows(store, 3);
      expect(store.remove('tb_role', 2)).toBe(true);

      expect(store.list<DemoRow>('tb_role').total).toBe(2);
      expect(store.getById<DemoRow>('tb_role', 2)).toBeUndefined();
      expect(store.list<DemoRow>('tb_role', { includeDeleted: true }).total).toBe(3);
      expect(
        store.list<DemoRow>('tb_role', { includeDeleted: true }).list.find((r) => r.id === 2)?.name,
      ).toBe('角色-2');
    });

    it('没有物理 DELETE：删除后含软删的总行数不变', () => {
      const store = make();
      seedRows(store, 5);
      store.remove('tb_role', 3);
      store.remove('tb_role', 4);
      expect(store.count('tb_role')).toBe(3);
      expect(store.count('tb_role', true)).toBe(5);
    });

    it('restore 可恢复，重复删除/恢复幂等', () => {
      const store = make();
      seedRows(store, 2);
      store.remove('tb_role', 1);
      expect(store.restore('tb_role', 1)).toBe(true);
      expect(store.getById<DemoRow>('tb_role', 1)?.name).toBe('角色-1');
      expect(store.restore('tb_role', 1)).toBe(false);
      expect(store.remove('tb_role', 1)).toBe(true);
      expect(store.remove('tb_role', 1)).toBe(false);
    });
  });

  describe(`${name} · 关联表（无外键）`, () => {
    it('link / links / unlink 语义等价，解除关系也是软删除', () => {
      const store = make();
      store.link('tb_role_menu', 1, 10, { scope: 'read' });
      store.link('tb_role_menu', 1, 20);
      store.link('tb_role_menu', 2, 30);

      const links = store.links('tb_role_menu', 1);
      expect(links).toHaveLength(2);
      expect(links.map((l) => l.menu_id)).toEqual(['10', '20']);
      expect(links[0]!.payload).toEqual({ scope: 'read' });
      expect(links[0]!._pk).toBeTruthy();

      expect(store.unlink('tb_role_menu', 1, 10)).toBe(true);
      expect(store.links('tb_role_menu', 1)).toHaveLength(1);
      expect(store.links('tb_role_menu', 1, { includeDeleted: true })).toHaveLength(2);
      expect(store.links('tb_role_menu', 1, { includeDeleted: true })[0]!.deleted).toBe(1);
      expect(store.unlink('tb_role_menu', 1, 10)).toBe(false);
      // 另一个实体的关系不受影响
      expect(store.links('tb_role_menu', 2)).toHaveLength(1);
    });
  });
}

describe('cuid 主键', () => {
  it('批量生成唯一、非空、非数字', () => {
    const ids = Array.from({ length: 200 }, () => genId());
    expect(new Set(ids).size).toBe(200);
    expect(ids.every((id) => id.length > 12)).toBe(true);
    expect(ids.every((id) => Number.isNaN(Number(id)))).toBe(true);
  });
});
