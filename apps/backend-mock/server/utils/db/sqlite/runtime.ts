/**
 * 仓储单例（SQLite 唯一实现）。
 *
 * 存储只有一个实现：`SqliteStore`。`MOCK_STORE` / `MemoryStore` 已下线，
 * 所有接口无论环境都走 SQLite 真实读写。
 *
 * 环境差异只体现在「是否自动播种业务内置数据」：
 * - dev / test：库为空或 seed 版本变更时清空并按内置数据重新播种；
 * - production：不写 seed 版本戳、不清空、不播种，表由 DDL 建好但保持空，
 *   业务数据只能由显式运维初始化（mock:seed）或接口写入产生。
 *
 * 单例挂在 globalThis[Symbol]，跨 Nitro dev 热重载保持同一连接与数据视图。
 */

import type { DataStore } from './store';

import { getDb } from './connection';
import { shouldSeedBuiltinData } from './env';
import { ensureSeedVersion } from './seed';
import { SqliteStore } from './store';

const STORE_KEY = Symbol.for('antdv.backend-mock.sqlite.store');

type GlobalWithStore = typeof globalThis & { [STORE_KEY]?: DataStore };

function globalRef(): GlobalWithStore {
  return globalThis as GlobalWithStore;
}

/** 当前生效的仓储（单例，跨 Nitro 热重载保持同一份数据视图） */
export function getStore(): DataStore {
  const g = globalRef();
  if (g[STORE_KEY]) return g[STORE_KEY]!;
  // 开发/测试才做「版本变更 → 清库 → 重新播种」；生产绝不触碰已有数据
  if (shouldSeedBuiltinData()) ensureSeedVersion();
  g[STORE_KEY] = new SqliteStore(getDb());
  return g[STORE_KEY]!;
}

/**
 * 测试辅助：丢弃仓储单例。切换 MOCK_DB_FILE / MOCK_ENV 后调用，
 * 再配合 closeDb() 关闭旧连接。
 */
export function resetStoreForTest(): void {
  delete globalRef()[STORE_KEY];
}
