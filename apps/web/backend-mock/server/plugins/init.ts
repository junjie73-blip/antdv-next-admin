/**
 * 启动初始化插件（Nitro v3）
 *
 * 1. 把 nitro.config.ts 的 runtimeConfig.stateFile 注入 store（持久化路径来自运行时配置）；
 * 2. 预注册源码接口清单：Nitro 的 handler 模块是懒加载的，不在启动时补齐的话，
 *    接口清单在首次命中前看不到任何条目；
 * 3. 用 Nitro 内置数据库能力（useDatabase().exec）执行标准 SQL 脚本，
 *    自动完成建库 / 建表 / 建索引 / 初始化元数据（server/db/schema.sql）。
 *
 * 生成式自定义接口的注册已随「Mock 数据中心」下线移除。
 */

// Nitro v3：显式导入，#imports 已移除；defineNitroPlugin → definePlugin
import { definePlugin } from 'nitro';
import { useDatabase } from 'nitro/database';
import { useRuntimeConfig } from 'nitro/runtime-config';

import { SCHEMA_SQL } from '../db/schema-sql.generated';
import { buildSourceManifest } from '../utils/registry';
import { registerManifest, setPersistFile } from '../utils/store';

export default definePlugin(() => {
  // 先定路径再碰 store，避免首次 getStore() 读到错误的持久化文件
  setPersistFile(String(useRuntimeConfig().stateFile ?? '.mock-state.json'));

  // 用 Nitro 内置 useDatabase().exec 一次执行标准 SQL 脚本，自动化初始化库结构。
  // 所有语句都是 IF NOT EXISTS / INSERT OR REPLACE，重复启动安全幂等。
  try {
    useDatabase().exec(SCHEMA_SQL);
  } catch (error) {
    // 初始化失败不能吞：否则后续所有接口都会因缺表整体 500，且难以定位
    throw new Error(
      `[backend-mock] 数据库初始化失败（schema.sql）: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  registerManifest(buildSourceManifest());
});
