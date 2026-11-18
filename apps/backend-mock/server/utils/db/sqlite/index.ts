/**
 * SQLite 数据层统一出口。
 *
 * 开关：`MOCK_STORE=memory`（默认，今日行为）| `MOCK_STORE=sqlite`（持久化）。
 * 回滚只需把环境变量切回 memory / 去掉即可，无需改任何代码。
 *
 * 单例放在 runtime.ts，避免与 collection.ts 形成循环依赖。
 */

export { getStore, isSqliteEnabled, resetStoreForTest } from './runtime';
export { defineCollection, nextBizId } from './collection';
export { defineKVMap } from './kv-map';
export { genId, idKey, nowIso } from './ids';
export { closeDb, currentDriver, resetDbForTest, resolveDbFile } from './connection';
export { ensureSeedVersion, readSeedVersion, writeSeedVersion } from './seed';
export { MemoryStore, SqliteStore, usedLinkTables } from './store';
export type { DataStore, LinkRow, Paged, QueryOpts, Row } from './store';
export { ENTITY_TABLES, LINK_TABLES, SEED_VERSION } from './schema';
