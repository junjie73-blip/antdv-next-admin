/**
 * SQLite 连接单例。
 *
 * - 挂在 `globalThis[Symbol.for(...)]`：Nitro dev 热重载会重新求值模块，
 *   用全局符号可避免每次重载都新开一个句柄导致 WAL 锁库 / 连接泄漏；
 * - 数据库文件默认落在 `apps/backend-mock/.data/mock.sqlite`（已 gitignore）；
 * - 驱动：better-sqlite3（同步 API，与现有 handler 的同步数组操作天然一致）。
 *   若本机缺少预编译二进制，可用 `MOCK_SQLITE_DRIVER=node` 切到 Node 22 内置的
 *   `node:sqlite`（需 `--experimental-sqlite`），见 driver.ts。
 */

import type { Database as BetterDatabase } from 'better-sqlite3';

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { dbFileName } from './env';
import { ALL_DDL } from './schema';

/** 统一数据库连接接口：better-sqlite3 与 node:sqlite 的 DatabaseSync 都满足 */
export interface DbConnection {
  close(): void;
  exec(sql: string): unknown;
  prepare(sql: string): DbStatement;
}

export interface DbStatement {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): unknown;
}

const CONNECTION_KEY = Symbol.for('antdv.backend-mock.sqlite.connection');
const DRIVER_KEY = Symbol.for('antdv.backend-mock.sqlite.driver');

type GlobalWithDb = typeof globalThis & {
  [CONNECTION_KEY]?: DbConnection;
  [DRIVER_KEY]?: string;
};

function globalRef(): GlobalWithDb {
  return globalThis as GlobalWithDb;
}

/**
 * 从当前模块向上找 `name === '@antdv/backend-mock'` 的包根。
 *
 * 不能只判断「有没有 package.json」：Nitro 产物自带
 * `.output/server/package.json`（name 为 `@antdv/backend-mock-prod`），
 * 误命中会让库文件落到 `.output/server/.data/`，构建一清理数据就没了。
 *
 * - dev：源码在 `server/utils/db/sqlite/`，向上 4 层到包根；
 * - build：产物在 `.output/server/`，跳过 -prod 声明后继续向上命中真包根。
 */
function resolvePackageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 8; depth++) {
    const manifest = join(dir, 'package.json');
    if (existsSync(manifest)) {
      try {
        const pkg = JSON.parse(readFileSync(manifest, 'utf8')) as { name?: string };
        if (pkg.name === '@antdv/backend-mock') return dir;
      } catch {
        // 损坏的 manifest 不当作包根，继续向上
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(process.cwd(), 'apps/backend-mock');
}

/**
 * 数据库文件路径：MOCK_DB_FILE 显式覆盖优先（测试用 :memory: / 临时文件 / 运维脚本）。
 * 否则按环境分库：dev → mock.sqlite，prod → mock.production.sqlite（见 env.ts）。
 */
export function resolveDbFile(): string {
  const override = process.env.MOCK_DB_FILE;
  if (override) return override === ':memory:' ? override : resolve(override);
  return join(resolvePackageRoot(), '.data', dbFileName());
}

function createConnection(file: string): DbConnection {
  // 惰性加载：只有真正取连接时才 require 原生模块，便于构建/分析阶段不触碰它。
  const require = createRequire(import.meta.url);

  if (process.env.MOCK_SQLITE_DRIVER === 'node') {
    // 零原生依赖兜底：Node >= 22.1 内置，需要 --experimental-sqlite。
    const { DatabaseSync: NodeDatabaseSync } = require('node:sqlite') as {
      DatabaseSync: new (file: string) => DbConnection;
    };
    globalRef()[DRIVER_KEY] = 'node';
    return new NodeDatabaseSync(file);
  }

  const Database = require('better-sqlite3') as new (file: string) => DbConnection;
  globalRef()[DRIVER_KEY] = 'better-sqlite3';
  return new Database(file);
}

/**
 * 取得（并按需初始化）连接：首次打开时执行全量 DDL。
 * `ALL_DDL` 全是 `CREATE IF NOT EXISTS`，重复执行安全。
 */
export function getDb(): DbConnection {
  const g = globalRef();
  if (g[CONNECTION_KEY]) return g[CONNECTION_KEY]!;

  const file = resolveDbFile();
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });

  const db = createConnection(file);
  if (g[DRIVER_KEY] === 'better-sqlite3') {
    // WAL：单进程多请求下写不阻塞读；node:sqlite 走 pragma 亦可，但不必强制
    const better = db as unknown as BetterDatabase;
    better.pragma('journal_mode = WAL');
    better.pragma('busy_timeout = 5000');
  }
  for (const ddl of ALL_DDL) db.exec(ddl);

  g[CONNECTION_KEY] = db;
  return db;
}

/** 当前驱动名，供诊断面板/日志使用 */
export function currentDriver(): string {
  return globalRef()[DRIVER_KEY] ?? (process.env.MOCK_SQLITE_DRIVER === 'node' ? 'node' : 'better-sqlite3');
}

/**
 * 关闭并清除单例。仅供 `mock:reset` 脚本、测试与进程退出使用；
 * 业务代码不要调用，否则其它 handler 会拿到已关闭句柄。
 */
export function closeDb(): void {
  const g = globalRef();
  if (!g[CONNECTION_KEY]) return;
  try {
    g[CONNECTION_KEY]!.close();
  } finally {
    delete g[CONNECTION_KEY];
    delete g[DRIVER_KEY];
  }
}

/** 测试辅助：切换数据库文件并丢弃旧连接 */
export function resetDbForTest(file: string): void {
  closeDb();
  process.env.MOCK_DB_FILE = file;
}
