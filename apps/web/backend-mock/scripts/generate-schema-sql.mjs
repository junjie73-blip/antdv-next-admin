#!/usr/bin/env node
/**
 * 从 schema.ts（DDL 单一真源）生成标准 SQL 初始化脚本。
 *
 *   pnpm --filter @antdv/web run schema:sql
 *
 * 产物 `server/db/schema.sql` 是一份可直接被 SQLite 执行的标准脚本：
 * - 建库级 PRAGMA（WAL / busy_timeout / foreign_keys）；
 * - 全部实体表 / 关联表 / 元数据表的 CREATE TABLE + 索引；
 * - 初始化 seed_version 元数据行。
 *
 * Nitro 启动时用内置 `useDatabase().exec(SQL文件内容)` 一次执行，
 * 实现「数据库结构自动化初始化」。所有 DDL 都是 IF NOT EXISTS，可重复执行。
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(HERE, '..');

const { ALL_DDL, SEED_VERSION, META_TABLE } = await import(
  '../server/utils/db/sqlite/schema.ts'
);

const header = `-- backend-mock 数据库初始化脚本（由 scripts/generate-schema-sql.mjs 生成，勿手改）
-- 单一真源：server/utils/db/sqlite/schema.ts
-- 执行方式：Nitro 启动时 useDatabase().exec(readFileSync('server/db/schema.sql'))
-- 全部语句可重复执行（CREATE IF NOT EXISTS / INSERT OR REPLACE）
-- seed_version = ${SEED_VERSION}

-- ========== 建库级 PRAGMA ==========
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = OFF;

`;

const footer = `
-- ========== 初始化元数据 ==========
INSERT OR REPLACE INTO ${META_TABLE} (key, value) VALUES ('seed_version', '${SEED_VERSION}');
`;

const body = ALL_DDL.map((ddl, i) => {
  const firstLine = ddl.split('\n')[0] ?? '';
  const isTable = firstLine.startsWith('CREATE TABLE');
  const label = isTable
    ? firstLine.match(/CREATE TABLE IF NOT EXISTS\s+(\S+)/)?.[1] ?? `table_${i}`
    : `index_${i}`;
  // ALL_DDL 每条内部已含完整分号，不再追加，避免产生空语句 `;;`
  return `-- ---- ${label} ----\n${ddl.trimEnd()}`;
}).join('\n\n');

const sql = `${header}${body}\n${footer}`;
const outDir = join(PACKAGE_ROOT, 'server/db');
mkdirSync(outDir, { recursive: true });

const outFile = join(outDir, 'schema.sql');
writeFileSync(outFile, sql, 'utf8');

// 同步产出 TS 常量版：Nitro 构建后无法可靠定位源码 .sql 路径，
// 运行时 import 这份常量，实现零路径依赖的自动化初始化。
const tsFile = join(outDir, 'schema-sql.generated.ts');
const tsContent = `/**
 * 数据库初始化脚本常量（由 scripts/generate-schema-sql.mjs 生成，勿手改）。
 * 源 SQL：server/db/schema.sql
 * 用途：Nitro 启动时 useDatabase().exec(SCHEMA_SQL) 一次建库建表。
 */
export const SCHEMA_SQL = ${JSON.stringify(sql)};
`;
writeFileSync(tsFile, tsContent, 'utf8');

console.log(
  `[schema:sql] 已生成 ${outFile} 与 ${tsFile}（${ALL_DDL.length} 条 DDL，seed_version=${SEED_VERSION}）`,
);
