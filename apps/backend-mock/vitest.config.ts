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
    // sqlite 模式下给测试默认隔离到内存库：demo-task 等老测试直接读写 `*_DB`
    // 数组（无临时库逻辑），不隔离会污染真实 .data/mock.sqlite，且依赖历史
    // 脏数据导致「双实现并行」验收不可重复。db-* 域的 e2e 测试在 beforeEach
    // 里会自行覆盖为临时文件，不受此项影响；memory 模式不注入，行为不变。
    env:
      process.env.MOCK_STORE === 'sqlite' && !process.env.MOCK_DB_FILE
        ? { MOCK_DB_FILE: ':memory:' }
        : {},
  },
});
