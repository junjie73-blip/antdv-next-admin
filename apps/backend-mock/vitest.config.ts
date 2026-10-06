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
  },
});
