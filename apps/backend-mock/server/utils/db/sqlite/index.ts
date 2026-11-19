/**
 * SQLite 数据层统一出口（唯一存储实现）。
 *
 * 所有接口无论 dev / prod 都走 SQLite；环境差异见 env.ts：
 * - dev / test：首次启动或 seed 版本变更时按内置数据播种；
 * - production：独立库文件，不播种、不清库，数据只能由接口 / 显式运维产生。
 *
 * 单例放在 runtime.ts，避免与 collection.ts 形成循环依赖。
 */

export { getStore, resetStoreForTest } from './runtime';
export { getMockEnv, isProduction, shouldSeedBuiltinData, dbFileName } from './env';
export { defineCollection, nextBizId } from './collection';
export { defineKVMap } from './kv-map';
export { genId, idKey, nowIso } from './ids';
export { closeDb, currentDriver, resetDbForTest, resolveDbFile } from './connection';
export { ensureSeedVersion, readSeedVersion, writeSeedVersion } from './seed';
export { SqliteStore, usedLinkTables } from './store';
export type { DataStore, LinkRow, Paged, QueryOpts, Row } from './store';
export { ENTITY_TABLES, LINK_TABLES, SEED_VERSION } from './schema';
