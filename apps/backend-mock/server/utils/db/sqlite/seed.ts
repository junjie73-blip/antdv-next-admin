/**
 * 种子版本管理。
 *
 * `__meta.seed_version` 与 `SEED_VERSION` 不一致时清空所有实体表/关联表并更新戳，
 * 各 `defineCollection` 在模块加载时检测到表为空会重新灌入种子数据
 * （复用确定性内置数据，数据确定性 => 可复现）。
 *
 * 注意：这里的 `DELETE FROM` 只用于**版本重建**，属于 DDL 级重置；
 * 业务侧的「删除」一律走 `DataStore.remove()` 软删除，不允许物理删除。
 */

import { getDb } from './connection';
import { ENTITY_TABLES, LINK_TABLES, META_TABLE, SEED_VERSION } from './schema';

const VERSION_KEY = 'seed_version';

/** 当前库内的版本戳（库不存在/未初始化时返回 null） */
export function readSeedVersion(): number | null {
  const row = getDb()
    .prepare(`SELECT value FROM ${META_TABLE} WHERE key = ?`)
    .get(VERSION_KEY) as { value: string } | undefined;
  if (!row) return null;
  const n = Number(row.value);
  return Number.isFinite(n) ? n : null;
}

/** 升级版本戳时重建；版本一致时什么都不做（保住跨重启的数据） */
export function ensureSeedVersion(): boolean {
  if (readSeedVersion() === SEED_VERSION) return false;

  const db = getDb();
  db.exec('BEGIN');
  try {
    for (const table of ENTITY_TABLES) db.prepare(`DELETE FROM ${table}`).run();
    for (const def of LINK_TABLES) db.prepare(`DELETE FROM ${def.table}`).run();
    db.prepare(
      `INSERT INTO ${META_TABLE} (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).run(VERSION_KEY, String(SEED_VERSION));
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return true;
}

/** 强制把版本戳写为当前值（供 mock:seed 脚本在建表后调用） */
export function writeSeedVersion(): void {
  getDb()
    .prepare(
      `INSERT INTO ${META_TABLE} (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(VERSION_KEY, String(SEED_VERSION));
}
