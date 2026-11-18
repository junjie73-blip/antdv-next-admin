/**
 * 仓储抽象：DataStore 接口 + MemoryStore / SqliteStore 双实现。
 *
 * 两种实现对外语义必须完全一致，由 `test/db-store.test.ts` 逐条守护：
 * - `insert` 生成 cuid 物理主键 `_pk`，业务 id 缺省时按库内 max+1 分配；
 * - `remove` 一律软删除（deleted=1 + deleted_at），**没有物理 DELETE**；
 * - `list` / `getById` 强制过滤 `deleted = 0`，除非显式 `includeDeleted`；
 * - `restore` 复位软删除；`link` / `unlink` / `links` 操作无外键的中间关联表。
 *
 * 注：筛选、模糊搜索、排序、分页目前仍由现有 handler 的 JS 数组逻辑完成
 * （`paginateList` 等），这里不做 SQL 下推 —— 方案 2.3 自评该处回归风险最高，
 * 先保证「零语义回归」，下推留到 P3 单独做。
 */

import type { DbConnection } from './connection';

import { getDb } from './connection';
import { genId, idKey, nowIso } from './ids';
import { assertTableName, linkDef } from './schema';

export interface QueryOpts {
  /** 显式读取已软删除的行（回收站 / 恢复场景） */
  includeDeleted?: boolean;
  /** 可选分页，仅用于双实现等价测试；业务列表仍走 paginateList */
  pageNum?: number;
  pageSize?: number;
  /** 简单等值筛选，仅用于单测与关联表查询 */
  where?: Record<string, unknown>;
}

export interface Paged<T> {
  list: T[];
  total: number;
}

export interface Row {
  [key: string]: unknown;
  id?: number | string;
}

export interface LinkRow {
  [key: string]: unknown;
  _pk: string;
  created_at: string;
  deleted: number;
  deleted_at: string | null;
  payload?: Record<string, unknown> | null;
}

export interface DataStore {
  readonly kind: 'memory' | 'sqlite';
  list<T extends object>(table: string, opts?: QueryOpts): Paged<T>;
  getById<T extends object>(table: string, id: unknown): T | undefined;
  /** 返回生成的 cuid 物理主键 */
  insert(table: string, row: object): string;
  /** 局部合并更新；返回是否命中 */
  update(table: string, id: unknown, patch: object): boolean;
  /** 软删除；返回是否命中 */
  remove(table: string, id: unknown): boolean;
  restore(table: string, id: unknown): boolean;
  /** 关联表：建立 / 解除 / 查询关系（同样软删除） */
  link(table: string, leftId: unknown, rightId: unknown, payload?: object): string;
  unlink(table: string, leftId: unknown, rightId: unknown): boolean;
  links(table: string, leftId: unknown, opts?: QueryOpts): LinkRow[];
  /** 仅供 seed/reset 使用：物理清空整表（不属于业务删除） */
  truncate(table: string): void;
  /** 表内行数（含/不含软删除） */
  count(table: string, includeDeleted?: boolean): number;
}

interface StoredRecord {
  _pk: string;
  biz_id: string;
  data: Row;
  deleted: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

const LINK_TABLE_NAMES = new Set<string>();

function toParams(values: unknown[]): unknown[] {
  return values.map((v) => (v === undefined ? null : v));
}

function matches(row: Row, where?: Record<string, unknown>): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => row[key] === value);
}

/* -------------------------------------------------------------------------- */
/* SqliteStore                                                                 */
/* -------------------------------------------------------------------------- */

export class SqliteStore implements DataStore {
  readonly kind = 'sqlite' as const;

  constructor(private readonly db: DbConnection = getDb()) {}

  private rows(table: string, includeDeleted = false): StoredRecord[] {
    assertTableName(table);
    const sql = `SELECT _pk, biz_id, data, deleted, deleted_at, created_at, updated_at
                 FROM ${table}
                 ${includeDeleted ? '' : 'WHERE deleted = 0'}
                 ORDER BY rowid`;
    const raw = this.db.prepare(sql).all() as Array<Record<string, unknown>>;
    return raw.map((r) => ({
      _pk: String(r._pk),
      biz_id: String(r.biz_id ?? ''),
      data: JSON.parse(String(r.data)) as Row,
      deleted: Number(r.deleted),
      deleted_at: r.deleted_at === null ? null : String(r.deleted_at),
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    }));
  }

  list<T extends object>(table: string, opts: QueryOpts = {}): Paged<T> {
    let items = this.rows(table, opts.includeDeleted)
      .map((r) => r.data)
      .filter((row) => matches(row, opts.where));
    const total = items.length;
    if (opts.pageNum !== undefined && opts.pageSize !== undefined) {
      const page = Math.max(1, Math.floor(opts.pageNum));
      const size = Math.max(1, Math.floor(opts.pageSize));
      items = items.slice((page - 1) * size, page * size);
    }
    // 返回浅拷贝：任何就地修改都必须经 Proxy -> update() 才能落库
    return { list: items.map((row) => ({ ...row })) as T[], total };
  }

  getById<T extends object>(table: string, id: unknown): T | undefined {
    const key = idKey(id);
    const found = this.rows(table).find((r) => r.biz_id === key);
    return found ? ({ ...found.data } as T) : undefined;
  }

  insert(table: string, row: object): string {
    assertTableName(table);
    const existing = this.rows(table, true);
    const data: Row = { ...row };
    if (data.id === undefined || data.id === null || data.id === '') {
      const max = existing.reduce((acc, r) => {
        const n = Number(r.biz_id);
        return Number.isFinite(n) ? Math.max(acc, n) : acc;
      }, 0);
      data.id = max + 1;
    }
    const pk = genId();
    const now = nowIso();
    this.db
      .prepare(
        `INSERT INTO ${table} (_pk, biz_id, data, deleted, deleted_at, created_at, updated_at)
         VALUES (?, ?, ?, 0, NULL, ?, ?)`,
      )
      .run(...toParams([pk, idKey(data.id), JSON.stringify(data), now, now]));
    // 同步回写调用方持有的对象（handler 常用 `DB.push(newRow)` 后直接 success(newRow)）
    Object.assign(row, data);
    return pk;
  }

  update(table: string, id: unknown, patch: object): boolean {
    assertTableName(table);
    const key = idKey(id);
    const found = this.rows(table).find((r) => r.biz_id === key);
    if (!found) return false;
    const data: Row = { ...found.data, ...patch };
    this.db
      .prepare(`UPDATE ${table} SET data = ?, biz_id = ?, updated_at = ? WHERE _pk = ?`)
      .run(...toParams([JSON.stringify(data), idKey(data.id), nowIso(), found._pk]));
    return true;
  }

  remove(table: string, id: unknown): boolean {
    assertTableName(table);
    const key = idKey(id);
    const found = this.rows(table).find((r) => r.biz_id === key);
    if (!found) return false;
    this.db
      .prepare(`UPDATE ${table} SET deleted = 1, deleted_at = ?, updated_at = ? WHERE _pk = ?`)
      .run(...toParams([nowIso(), nowIso(), found._pk]));
    return true;
  }

  restore(table: string, id: unknown): boolean {
    assertTableName(table);
    const key = idKey(id);
    const found = this.rows(table, true).find((r) => r.biz_id === key && r.deleted === 1);
    if (!found) return false;
    this.db
      .prepare(`UPDATE ${table} SET deleted = 0, deleted_at = NULL, updated_at = ? WHERE _pk = ?`)
      .run(...toParams([nowIso(), found._pk]));
    return true;
  }

  count(table: string, includeDeleted = false): number {
    assertTableName(table);
    const sql = `SELECT COUNT(*) AS n FROM ${table}${includeDeleted ? '' : ' WHERE deleted = 0'}`;
    const row = this.db.prepare(sql).get() as { n: number } | undefined;
    return Number(row?.n ?? 0);
  }

  truncate(table: string): void {
    assertTableName(table);
    // 仅 seed/reset 调用；业务删除一律走软删除 remove()
    this.db.prepare(`DELETE FROM ${table}`).run();
  }

  link(table: string, leftId: unknown, rightId: unknown, payload: object = {}): string {
    const def = linkDef(table);
    if (!def) throw new Error(`[mock-sqlite] 未知的关联表: ${table}`);
    const pk = genId();
    this.db
      .prepare(
        `INSERT INTO ${table} (_pk, ${def.left}, ${def.right}, payload, deleted, deleted_at, created_at)
         VALUES (?, ?, ?, ?, 0, NULL, ?)`,
      )
      .run(...toParams([pk, idKey(leftId), idKey(rightId), JSON.stringify(payload), nowIso()]));
    LINK_TABLE_NAMES.add(table);
    return pk;
  }

  unlink(table: string, leftId: unknown, rightId: unknown): boolean {
    const def = linkDef(table);
    if (!def) throw new Error(`[mock-sqlite] 未知的关联表: ${table}`);
    const affected = this.db
      .prepare(
        `UPDATE ${table} SET deleted = 1, deleted_at = ?
         WHERE ${def.left} = ? AND ${def.right} = ? AND deleted = 0`,
      )
      .run(...toParams([nowIso(), idKey(leftId), idKey(rightId)]));
    // better-sqlite3 的 run() 返回 { changes }；node:sqlite 同理
    return Number((affected as { changes?: number })?.changes ?? 0) > 0;
  }

  links(table: string, leftId: unknown, opts: QueryOpts = {}): LinkRow[] {
    const def = linkDef(table);
    if (!def) throw new Error(`[mock-sqlite] 未知的关联表: ${table}`);
    const sql = `SELECT * FROM ${table}
                 WHERE ${def.left} = ? ${opts.includeDeleted ? '' : 'AND deleted = 0'}
                 ORDER BY rowid`;
    const raw = this.db.prepare(sql).all(...toParams([idKey(leftId)])) as Array<
      Record<string, unknown>
    >;
    return raw
      .map((r) => ({
        ...r,
        _pk: String(r._pk),
        created_at: String(r.created_at),
        deleted: Number(r.deleted),
        deleted_at: r.deleted_at === null ? null : String(r.deleted_at),
        payload: r.payload ? (JSON.parse(String(r.payload)) as Row) : null,
      }))
      .filter((r) => matches(r as unknown as Row, opts.where)) as LinkRow[];
  }
}

/* -------------------------------------------------------------------------- */
/* MemoryStore                                                                 */
/* -------------------------------------------------------------------------- */

interface MemoryRecord {
  record: StoredRecord;
  seq: number;
}

/**
 * 内存实现：与 SqliteStore 行为等价的兜底 / 对照实现。
 * `MOCK_STORE=memory`（默认）时由它承载数据，且现有 `*_DB` 数组仍可被
 * 未迁移的模块直接读写 —— 迁移期与回滚期都靠它保持今日行为。
 */
export class MemoryStore implements DataStore {
  readonly kind = 'memory' as const;

  private readonly tables = new Map<string, MemoryRecord[]>();
  private readonly linkTables = new Map<string, LinkRow[]>();
  private seq = 0;

  private bucket(table: string): MemoryRecord[] {
    assertTableName(table);
    let rows = this.tables.get(table);
    if (!rows) {
      rows = [];
      this.tables.set(table, rows);
    }
    return rows;
  }

  private visible(table: string, includeDeleted = false): MemoryRecord[] {
    return this.bucket(table)
      .filter((r) => includeDeleted || r.record.deleted === 0)
      .sort((a, b) => a.seq - b.seq);
  }

  list<T extends object>(table: string, opts: QueryOpts = {}): Paged<T> {
    let items = this.visible(table, opts.includeDeleted)
      .map((r) => r.record.data)
      .filter((row) => matches(row, opts.where));
    const total = items.length;
    if (opts.pageNum !== undefined && opts.pageSize !== undefined) {
      const page = Math.max(1, Math.floor(opts.pageNum));
      const size = Math.max(1, Math.floor(opts.pageSize));
      items = items.slice((page - 1) * size, page * size);
    }
    return { list: items.map((row) => ({ ...row })) as T[], total };
  }

  getById<T extends object>(table: string, id: unknown): T | undefined {
    const key = idKey(id);
    const found = this.visible(table).find((r) => r.record.biz_id === key);
    return found ? ({ ...found.record.data } as T) : undefined;
  }

  insert(table: string, row: object): string {
    const bucket = this.bucket(table);
    const data: Row = { ...row };
    if (data.id === undefined || data.id === null || data.id === '') {
      const max = bucket.reduce((acc, r) => {
        const n = Number(r.record.biz_id);
        return Number.isFinite(n) ? Math.max(acc, n) : acc;
      }, 0);
      data.id = max + 1;
    }
    const pk = genId();
    const now = nowIso();
    bucket.push({
      seq: this.seq++,
      record: {
        _pk: pk,
        biz_id: idKey(data.id),
        data,
        deleted: 0,
        deleted_at: null,
        created_at: now,
        updated_at: now,
      },
    });
    Object.assign(row, data);
    return pk;
  }

  update(table: string, id: unknown, patch: object): boolean {
    const found = this.visible(table).find((r) => r.record.biz_id === idKey(id));
    if (!found) return false;
    found.record.data = { ...found.record.data, ...patch };
    found.record.biz_id = idKey(found.record.data.id);
    found.record.updated_at = nowIso();
    return true;
  }

  remove(table: string, id: unknown): boolean {
    const found = this.visible(table).find((r) => r.record.biz_id === idKey(id));
    if (!found) return false;
    found.record.deleted = 1;
    found.record.deleted_at = nowIso();
    found.record.updated_at = nowIso();
    return true;
  }

  restore(table: string, id: unknown): boolean {
    const found = this.bucket(table).find(
      (r) => r.record.biz_id === idKey(id) && r.record.deleted === 1,
    );
    if (!found) return false;
    found.record.deleted = 0;
    found.record.deleted_at = null;
    found.record.updated_at = nowIso();
    return true;
  }

  count(table: string, includeDeleted = false): number {
    return this.visible(table, includeDeleted).length;
  }

  truncate(table: string): void {
    this.tables.set(table, []);
    this.linkTables.delete(table);
  }

  link(table: string, leftId: unknown, rightId: unknown, payload: object = {}): string {
    const def = linkDef(table);
    if (!def) throw new Error(`[mock-sqlite] 未知的关联表: ${table}`);
    let rows = this.linkTables.get(table);
    if (!rows) {
      rows = [];
      this.linkTables.set(table, rows);
    }
    const pk = genId();
    rows.push({
      _pk: pk,
      [def.left]: idKey(leftId),
      [def.right]: idKey(rightId),
      payload: payload as Record<string, unknown>,
      deleted: 0,
      deleted_at: null,
      created_at: nowIso(),
    });
    LINK_TABLE_NAMES.add(table);
    return pk;
  }

  unlink(table: string, leftId: unknown, rightId: unknown): boolean {
    const def = linkDef(table);
    if (!def) throw new Error(`[mock-sqlite] 未知的关联表: ${table}`);
    const rows = this.linkTables.get(table) ?? [];
    let hit = false;
    for (const row of rows) {
      if (
        row[def.left] === idKey(leftId) &&
        row[def.right] === idKey(rightId) &&
        row.deleted === 0
      ) {
        row.deleted = 1;
        row.deleted_at = nowIso();
        hit = true;
      }
    }
    return hit;
  }

  links(table: string, leftId: unknown, opts: QueryOpts = {}): LinkRow[] {
    const def = linkDef(table);
    if (!def) throw new Error(`[mock-sqlite] 未知的关联表: ${table}`);
    return (this.linkTables.get(table) ?? [])
      .filter((r) => r[def.left] === idKey(leftId))
      .filter((r) => opts.includeDeleted || r.deleted === 0)
      .filter((r) => matches(r as unknown as Row, opts.where))
      .map((r) => ({ ...r }));
  }
}

/** 已使用过的关联表（诊断用） */
export function usedLinkTables(): string[] {
  return [...LINK_TABLE_NAMES];
}
