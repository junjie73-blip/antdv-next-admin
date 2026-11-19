import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * 单元测试配置
 *
 * server 侧代码通过 Nitro 的虚拟模块 `#imports` 拿 h3 运行时 API，
 * 该模块只有 Nitro 构建期才存在；测试里用一份行为等价的最小实现替换，
 * 这样纯逻辑（运行时管道、清单、模板、匹配）无需拉起整个服务即可覆盖。
 */
export default defineConfig({
  resolve: {
    alias: {
      '#imports': fileURLToPath(
        new URL('test/fixtures/nitro-imports.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // SQLite 是唯一存储：测试默认隔离到内存库，避免 demo-task 等老测试直接
    // 读写 `*_DB` 数组时污染真实 .data/mock.sqlite 或依赖历史脏数据，
    // 保证验收可重复。db-* 域 e2e 测试在 beforeEach 里自行覆盖为临时文件，
    // 不受此项影响。MOCK_ENV 未设置时 env.ts 判定为 development（会播种）。
    env:
      !process.env.MOCK_DB_FILE
        ? { MOCK_DB_FILE: ':memory:' }
        : {},
  },
});
