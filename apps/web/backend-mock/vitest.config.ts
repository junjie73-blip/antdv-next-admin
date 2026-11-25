import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * 单元测试配置
 *
 * server 侧代码从 Nitro 的运行时模块拿 h3 / Nitro API：
 * v2 是 `#imports`，v3 拆成 `nitro` / `nitro/h3` / `nitro/runtime-config`。
 * 这些模块只有 Nitro 构建期或运行时才存在；测试里统一 alias 到一份
 * 行为等价的最小实现，纯逻辑（运行时管道、清单、模板、匹配）无需拉起服务即可覆盖。
 *
 * 用正则精确匹配，避免 `nitro` 的前缀匹配吃掉 `nitro/h3` 等子路径。
 */
const nitroFixture = fileURLToPath(
  new URL('test/fixtures/nitro-imports.ts', import.meta.url),
);
const kvFixture = fileURLToPath(
  new URL('test/fixtures/nitro-kv.ts', import.meta.url),
);
const cacheFixture = fileURLToPath(
  new URL('test/fixtures/nitro-cache.ts', import.meta.url),
);
const taskFixture = fileURLToPath(
  new URL('test/fixtures/nitro-task.ts', import.meta.url),
);

export default defineConfig({
  resolve: {
    alias: [
      { find: /^#imports$/, replacement: nitroFixture },
      { find: /^nitro\/h3$/, replacement: nitroFixture },
      { find: /^nitro\/runtime-config$/, replacement: nitroFixture },
      { find: /^nitro\/database$/, replacement: nitroFixture },
      { find: /^nitro\/cache$/, replacement: cacheFixture },
      { find: /^nitro\/kv$/, replacement: kvFixture },
      { find: /^nitro\/storage$/, replacement: kvFixture },
      { find: /^nitro\/task$/, replacement: taskFixture },
      { find: /^nitro$/, replacement: nitroFixture },
    ],
  },
  test: {
    environment: 'node',
    // 迁入 web 后必须显式把测试根钉在 backend-mock/，否则 vitest 会用 cwd(apps/web)
    // 去找 `test/**`，误跑前端的图标对账用例而完全跳过服务端测试。
    root: fileURLToPath(new URL('.', import.meta.url)),
    include: ['test/**/*.test.ts'],
    // SQLite 是唯一存储：测试默认隔离到内存库，避免 demo-task 等老测试直接
    // 读写 `*_DB` 数组时污染真实 .data/mock.sqlite 或依赖历史脏数据，
    // 保证验收可重复。db-* 域 e2e 测试在 beforeEach 里自行覆盖为临时文件，
    // 不受此项影响。MOCK_ENV 未设置时 env.ts 判定为 development（会播种）。
    env: process.env.MOCK_DB_FILE ? {} : { MOCK_DB_FILE: ':memory:' },
  },
});
