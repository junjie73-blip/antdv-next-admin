/**
 * SQLite 连接单例（基于 Nitro 内置数据库层 / db0）
 *
 * 改造说明（Nitro v3）：
 * - 连接不再用手写 createRequire + 原生模块分支创建，而是走 Nitro 内置数据库层
 *   所依赖的同一个 db0 抽象：`createDatabase(nodeSqliteConnector(...))`；
 *   这与 nitro.config.ts 里 `experimental.database` + `useDatabase()` 是同一套实现，
 *   只是这里取 `getInstance()` 的原生同步 client，承接现有 handler 的同步数组语义。
 * - 建表由启动插件 `plugins/init.ts` 用 Nitro 内置 `useDatabase().exec(SCHEMA_SQL)`
 *   执行标准 SQL 文件完成；这里仍保留一次 DDL 兜底（CREATE IF NOT EXISTS，幂等），
 *   让未走 Nitro 插件的场景（单测 / 运维脚本直接 import）也能拿到可用库。
 *
 * - 单例挂在 `globalThis[Symbol.for(...)]`：Nitro dev 热重载会重新求值模块，
 *   用全局符号避免每次重载都新开句柄导致 WAL 锁库 / 连接泄漏；
 * - 库文件路径：`MOCK_DB_FILE` 显式覆盖优先，否则按环境分库
 *   （dev → mock.sqlite，prod → mock.production.sqlite，见 env.ts）。
 */

import { createDatabase } from 'db0';
import nodeSqliteConnector from 'db0/connectors/node-sqlite';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { dbFileName } from './env';
import { ALL_DDL } from './schema';

/** 统一数据库连接接口：node:sqlite 的 DatabaseSync 满足该接口 */
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
 * 从当前模块向上找 `name === '@antdv/web'` 的包根。
 *
 * 不能只判断「有没有 package.json」：Nitro 产物自带
 * `.output/server/package.json`，误命中会让库文件落到 `.output/server/.data/`，
 * 构建一清理数据就没了。mock 代码迁入 web 后，数据库与 KV 都归 apps/web/.data。
 */
function resolvePackageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 8; depth++) {
    const manifest = join(dir, 'package.json');
    if (existsSync(manifest)) {
      try {
        const pkg = JSON.parse(readFileSync(manifest, 'utf8')) as {
          name?: string;
        };
        if (pkg.name === '@antdv/web') return dir;
      } catch {
        // 损坏的 manifest 不当作包根，继续向上
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(process.cwd());
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

/**
 * 通过 Nitro 内置 db0 抽象创建连接，取底层同步 client。
 *
 * nodeSqliteConnector 的 getInstance() 在 node:sqlite 驱动下同步返回 DatabaseSync，
 * 其 prepare()/exec() 均为同步，与既有 handler 的数组式读写语义一致。
 */
function createConnection(file: string): DbConnection {
  const isMemory = file === ':memory:';
  // db0 的 node-sqlite 连接器：':memory:' 走 name，其余走绝对路径 path。
  const connector = isMemory
    ? nodeSqliteConnector({ name: ':memory:' })
    : nodeSqliteConnector({ path: file });
  const db = createDatabase(connector);
  // getInstance() 的运行时返回值是同步 DatabaseSync（类型声明放宽为 Promise）。
  const client = db.getInstance() as unknown as DbConnection;
  globalRef()[DRIVER_KEY] = 'node-sqlite(db0)';
  return client;
}

/**
 * 取得（并按需初始化）连接：首次打开时执行全量 DDL 兜底。
 * ALL_DDL 全是 CREATE IF NOT EXISTS，重复执行安全；启动插件已先用
 * useDatabase().exec(SCHEMA_SQL) 建过表，这里再跑一次不会重复建。
 */
export function getDb(): DbConnection {
  const g = globalRef();
  if (g[CONNECTION_KEY]) return g[CONNECTION_KEY]!;

  const file = resolveDbFile();
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });

  const db = createConnection(file);
  // WAL：单进程多请求下写不阻塞读；busy_timeout 避免偶发锁冲突。
  // 原生 DatabaseSync 没有 pragma() 方法，统一用 exec 执行 PRAGMA 语句。
  if (file !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA busy_timeout = 5000;');
  }
  for (const ddl of ALL_DDL) db.exec(ddl);

  g[CONNECTION_KEY] = db;
  return db;
}

/** 当前驱动名，供诊断面板/日志使用 */
export function currentDriver(): string {
  return globalRef()[DRIVER_KEY] ?? 'node-sqlite(db0)';
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
