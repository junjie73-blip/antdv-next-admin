/**
 * 仓储实现：SqliteStore（SQLite 唯一实现）。
 *
 * 对外语义由 `test/db-store.test.ts` 逐条守护：
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
  readonly kind: 'sqlite';
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

/** 已使用过的关联表（诊断用） */
export function usedLinkTables(): string[] {
  return [...LINK_TABLE_NAMES];
}
