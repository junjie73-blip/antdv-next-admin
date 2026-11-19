/**
 * 运行环境判定（backend-mock 单一事实来源）。
 *
 * 背景：SQLite 已成为唯一存储实现，但「开发环境」与「生产环境」的语义不同：
 * - development / test：本地联调，首次启动自动播种确定性内置数据（builtin-data.ts），
 *   并提供运行时控制面（延迟 / 失败注入 / 配置重置）便于演示与验收；
 * - production：独立数据库文件，**不自动播种业务数据**，运行时控制面写操作关闭，
 *   所有接口走真实 SQLite 读写（数据由运维显式初始化或由 API 写入）。
 *
 * 判定优先级：`MOCK_ENV` > `NODE_ENV` > 'development'。
 * 显式提供 `MOCK_ENV` 是为了不依赖 Nitro/构建产物是否替我们设置 NODE_ENV：
 * 生产启动时用 `MOCK_ENV=production` 即可，dev/test 不设置走默认。
 *
 * 本模块无外部依赖（尤其不 import connection.ts），避免与连接单例形成环。
 */

export const PROD_DB_NAME = 'mock.production.sqlite';
export const DEV_DB_NAME = 'mock.sqlite';

export type MockEnv = 'production' | 'development' | 'test';

/** 当前运行环境 */
export function getMockEnv(): MockEnv {
  const raw = (process.env.MOCK_ENV ?? process.env.NODE_ENV ?? 'development').toLowerCase();
  if (raw === 'production' || raw === 'prod') return 'production';
  if (raw === 'test') return 'test';
  return 'development';
}

export function isProduction(): boolean {
  return getMockEnv() === 'production';
}

/**
 * 是否自动播种业务内置数据（用户 / 角色 / 日志 / 任务等）。
 * 生产环境关闭：避免把演示用的确定性数据当成真实数据写进生产库。
 *
 * 注意：系统配置默认值（tb_config / CONFIG_DEFAULTS）不在此列 —— 它是应用
 * 正常运行所需的配置项，不是伪造的业务记录，任何环境都会初始化。
 */
export function shouldSeedBuiltinData(): boolean {
  return getMockEnv() !== 'production';
}

/** 数据库文件名（不含目录）；具体路径由 connection.ts 的 resolveDbFile() 拼接 */
export function dbFileName(): string {
  return isProduction() ? PROD_DB_NAME : DEV_DB_NAME;
}
