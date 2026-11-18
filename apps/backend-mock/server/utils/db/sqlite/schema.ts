/**
 * SQLite 表结构单一真源（DDL 常量）。
 *
 * 设计要点（对齐 SQLITE_MIGRATION_PLAN.md 1.1 的「阿里规范」）：
 * - 物理主键 `_pk TEXT PRIMARY KEY`，取值由 cuid2 生成，**不使用自增整型**；
 * - 对外业务 id 另存 `biz_id`（TEXT），避免把 number 契约改成 string 后
 *   击穿 handler 里的 `Number(params.id)` 与前端表格/表单；
 * - 整行业务数据存 `data` JSON 列：字段增减无需改 DDL，且 `Object.keys(record)`
 *   （详情页用）拿到的始终是纯业务字段，不含任何内部列；
 * - 每张表（含关联表）统一 `deleted` / `deleted_at`，删除一律软删除；
 * - 表之间**不使用外键**，关系一律由独立的中间关联表表达。
 *
 * ⚠️ 本文件必须保持「零 import」：`scripts/mock-db.mjs` 用
 * `node --experimental-strip-types` 直接 import 它，不能出现无后缀相对导入。
 */

/** 播种版本戳：DDL 或种子规则变更后 +1，服务启动检测不匹配会自动重建 */
export const SEED_VERSION = 2;

/** 元数据表：存放 seed_version 等 */
export const META_TABLE = '__meta';

/** 可变实体表（P2 逐个接入，未接入的表仍为空、不影响内存实现） */
export const ENTITY_TABLES = [
  'tb_user',
  'tb_dept',
  'tb_role',
  'tb_post',
  'tb_dict_type',
  'tb_dict_item',
  'tb_notice',
  'tb_file',
  'tb_online',
  'tb_oper_log',
  'tb_login_log',
  'tb_client_log',
  'tb_captcha_log',
  'tb_settings',
  'tb_config',
  'tb_task',
  'tb_workflow',
  // 演示表格 / 安全中心：原本每次请求现造，现改为持久化内置数据 + 真实查询
  'tb_table_demo',
  'tb_security_event',
  'tb_security_alert',
] as const;

export type EntityTable = (typeof ENTITY_TABLES)[number];

/**
 * 关联表定义：`left` / `right` 为业务列名，不含 FOREIGN KEY。
 * 关联表自身也有软删除列，解除关系 = 把该行置 deleted=1。
 */
export const LINK_TABLES = [
  { table: 'tb_user_dept', left: 'user_id', right: 'dept_id' },
  { table: 'tb_user_role', left: 'user_id', right: 'role_id' },
  { table: 'tb_user_post', left: 'user_id', right: 'post_id' },
  { table: 'tb_role_menu', left: 'role_id', right: 'menu_id' },
] as const;

export type LinkTable = (typeof LINK_TABLES)[number]['table'];

/** 通用实体列（对外只暴露 `data` 反序列化后的内容） */
export const ENTITY_COLUMNS = [
  '_pk',
  'biz_id',
  'data',
  'deleted',
  'deleted_at',
  'created_at',
  'updated_at',
] as const;

function entityDdl(table: string): string {
  return [
    `CREATE TABLE IF NOT EXISTS ${table} (`,
    '  _pk        TEXT PRIMARY KEY,',
    '  biz_id     TEXT,',
    '  data       TEXT NOT NULL,',
    '  deleted    INTEGER NOT NULL DEFAULT 0,',
    '  deleted_at TEXT,',
    '  created_at TEXT NOT NULL,',
    '  updated_at TEXT NOT NULL',
    ');',
    `CREATE INDEX IF NOT EXISTS idx_${table}_deleted ON ${table}(deleted);`,
    `CREATE INDEX IF NOT EXISTS idx_${table}_biz ON ${table}(biz_id);`,
    `CREATE INDEX IF NOT EXISTS idx_${table}_created ON ${table}(created_at);`,
  ].join('\n');
}

function linkDdl(def: (typeof LINK_TABLES)[number]): string {
  const { table, left, right } = def;
  return [
    `CREATE TABLE IF NOT EXISTS ${table} (`,
    '  _pk        TEXT PRIMARY KEY,',
    `  ${left.padEnd(10)} TEXT NOT NULL,`,
    `  ${right.padEnd(10)} TEXT NOT NULL,`,
    '  payload    TEXT,',
    '  deleted    INTEGER NOT NULL DEFAULT 0,',
    '  deleted_at TEXT,',
    '  created_at TEXT NOT NULL',
    ');',
    `CREATE INDEX IF NOT EXISTS idx_${table}_left ON ${table}(${left});`,
    `CREATE INDEX IF NOT EXISTS idx_${table}_right ON ${table}(${right});`,
    `CREATE INDEX IF NOT EXISTS idx_${table}_deleted ON ${table}(deleted);`,
  ].join('\n');
}

/** 全量 DDL，`CREATE IF NOT EXISTS` 可重复执行 */
export const ALL_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS ${META_TABLE} (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);`,
  ...ENTITY_TABLES.map(entityDdl),
  ...LINK_TABLES.map(linkDdl),
];

const TABLE_NAME_RE = /^tb_[a-z0-9_]+$/;

/** 表名白名单：防止把外部输入拼进 SQL（DDL/CRUD 都走这里校验） */
export function assertTableName(table: string): void {
  if (!TABLE_NAME_RE.test(table)) {
    throw new Error(`[mock-sqlite] 非法表名: ${table}`);
  }
}

/** 关联表元数据查表 */
export function linkDef(table: string): (typeof LINK_TABLES)[number] | undefined {
  return LINK_TABLES.find((item) => item.table === table);
}
