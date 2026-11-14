import { defineConfig } from 'vitest/config';

/** 纯计算包，不需要 DOM 环境；node 环境起跑快且能直接跑在 CI 容器里 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['__tests__/**/*.test.ts'],
    name: 'graph',
  },
});
