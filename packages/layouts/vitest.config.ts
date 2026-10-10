import { defineConfig } from 'vitest/config';

/**
 * 布局模型是纯计算（菜单树 → 区域开关 / 面包屑 / 宽度样式），
 * 用 node 环境即可，不需要 DOM；`computed` 在测试里直接读 `.value` 就是同步求值。
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    name: 'layouts',
  },
});
