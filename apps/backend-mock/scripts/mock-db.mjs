#!/usr/bin/env node
/**
 * backend-mock 数据库运维脚本（无需启动 Nitro）。
 *
 *   pnpm mock:seed    强制重建：删库 -> 建表 -> 写入 seed_version
 *   pnpm mock:reset   回到干净状态：删库（下次启动自动建表；dev 自动播种，prod 保持空）
 *   pnpm mock:db:info 查看库文件、驱动、版本戳与各表行数
 *
 * 环境分库（见 server/utils/db/sqlite/env.ts）：
 * - dev / test：`mock.sqlite`，服务启动会自动播种内置数据；
 * - production：`mock.production.sqlite`，服务启动**不播种、不清库**。
 *
 * 生产环境执行 seed / reset 属破坏性操作，必须显式追加 `--force`：
 *   pnpm mock:seed -- --force
 *
 * 种子数据本身由 `defineCollection` 在模块加载时惰性灌入（表为空才写，仅 dev/test），
 * 所以删库后服务首次启动即得到一份固定 seed 的干净数据，且之后跨重启保留。
 *
 * 运行依赖 Node >= 22 的 `--experimental-strip-types`（直接 import schema.ts / env.ts）。
 */

import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(HERE, '..');
const DATA_DIR = join(PACKAGE_ROOT, '.data');

const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith('--')) ?? 'info';
const force = args.includes('--force');

const { isProduction, dbFileName } = await import('../server/utils/db/sqlite/env.ts');
const DB_FILE = join(DATA_DIR, dbFileName());
const PRODUCTION = isProduction();

/** 删除当前环境对应的库及其 WAL / SHM 附属文件 */
function removeDatabase() {
  if (!existsSync(DATA_DIR)) return;
  const stem = dbFileName().replace(/\.sqlite$/, '');
  for (const name of readdirSync(DATA_DIR)) {
    if (
      name.startsWith(stem) &&
      (name === `${stem}.sqlite` || name.startsWith(`${stem}.sqlite-`))
    ) {
      rmSync(join(DATA_DIR, name), { force: true });
    }
  }
}

function assertDestructiveAllowed() {
  if (PRODUCTION && !force) {
    console.error(
      `[mock-db] 拒绝在 production 环境执行 \`${command}\`（破坏性操作）。\n` +
        '如确需初始化生产库，请显式追加 --force：pnpm mock:' +
        `${command} -- --force`,
    );
    process.exit(1);
  }
}

function openDb() {
  // 用 MOCK_DB_FILE 让 seed.ts / connection.ts 指向同一文件
  process.env.MOCK_DB_FILE = DB_FILE;
  const Database = require('better-sqlite3');
  return new Database(DB_FILE);
}

async function loadSchema() {
  return await import('../server/utils/db/sqlite/schema.ts');
}

async function seed() {
  assertDestructiveAllowed();
  removeDatabase();
  mkdirSync(DATA_DIR, { recursive: true });
  const { ALL_DDL, SEED_VERSION, META_TABLE } = await loadSchema();
  const db = openDb();
  for (const ddl of ALL_DDL) db.exec(ddl);
  db.prepare(
    `INSERT INTO ${META_TABLE} (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run('seed_version', String(SEED_VERSION));
  db.close();
  console.log(`[mock-db] 已重建 ${DB_FILE}（seed_version=${SEED_VERSION}）`);
  console.log(
    PRODUCTION
      ? '[mock-db] 生产环境：表结构已建好但不播种业务数据，数据由接口写入产生。'
      : '[mock-db] 种子数据将在服务首次启动时自动灌入。',
  );
}

function reset() {
  assertDestructiveAllowed();
  removeDatabase();
  console.log(
    `[mock-db] 已删除 ${DB_FILE} 及 WAL 附属文件；下次启动自动重建（${PRODUCTION ? 'prod 不播种' : 'dev 自动播种'}）。`,
  );
}

async function info() {
  const { ENTITY_TABLES, LINK_TABLES, SEED_VERSION } = await loadSchema();
  console.log(`[mock-db] 环境 = ${PRODUCTION ? 'production' : 'development/test'}`);
  console.log(`[mock-db] 库文件 = ${DB_FILE}`);
  console.log(`[mock-db] 期望 seed_version = ${SEED_VERSION}`);
  if (!existsSync(DB_FILE)) {
    console.log('[mock-db] 数据库尚未创建（未启动服务）。');
    return;
  }
  const db = openDb();
  const version = db.prepare("SELECT value FROM __meta WHERE key = 'seed_version'").get();
  console.log(`[mock-db] 当前 seed_version = ${version?.value ?? '(未写入)'}`);
  console.log(`[mock-db] 文件大小 = ${(statSync(DB_FILE).size / 1024).toFixed(1)} KB`);
  for (const table of [...ENTITY_TABLES, ...LINK_TABLES.map((d) => d.table)]) {
    const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get();
    if (row.n > 0) console.log(`  ${table.padEnd(20)} ${row.n} 行`);
  }
  db.close();
}

switch (command) {
  case 'seed':
    await seed();
    break;
  case 'reset':
    reset();
    break;
  case 'info':
    await info();
    break;
  default:
    console.error(`[mock-db] 未知命令: ${command}（可用 seed / reset / info）`);
    process.exitCode = 1;
}
