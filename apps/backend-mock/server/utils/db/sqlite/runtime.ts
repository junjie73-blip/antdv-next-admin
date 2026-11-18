/**
 * 仓储单例与开关（独立文件，避免 index.ts 与 collection.ts 循环依赖）。
 *
 * `MOCK_STORE=memory`（默认）完全不加载 better-sqlite3 原生模块，
 * 因此即使本机预编译二进制缺失，回滚路径也一定能跑起来。
 */

import type { DataStore } from './store';

import { getDb } from './connection';
import { ensureSeedVersion } from './seed';
import { MemoryStore, SqliteStore } from './store';

const STORE_KEY = Symbol.for('antdv.backend-mock.sqlite.store');

type GlobalWithStore = typeof globalThis & { [STORE_KEY]?: DataStore };

function globalRef(): GlobalWithStore {
  return globalThis as GlobalWithStore;
}

/** 当前生效的仓储（单例，跨 Nitro 热重载保持同一份数据视图） */
export function getStore(): DataStore {
  const g = globalRef();
  if (g[STORE_KEY]) return g[STORE_KEY]!;

  const useSqlite = process.env.MOCK_STORE === 'sqlite';
  if (useSqlite) {
    ensureSeedVersion();
    g[STORE_KEY] = new SqliteStore(getDb());
  } else {
    g[STORE_KEY] = new MemoryStore();
  }
  return g[STORE_KEY]!;
}

export function isSqliteEnabled(): boolean {
  return getStore().kind === 'sqlite';
}

/**
 * 测试辅助：丢弃仓储单例。切换 MOCK_STORE / MOCK_DB_FILE 后调用，
 * 再配合 closeDb() 关闭旧连接。
 */
export function resetStoreForTest(): void {
  delete globalRef()[STORE_KEY];
}
