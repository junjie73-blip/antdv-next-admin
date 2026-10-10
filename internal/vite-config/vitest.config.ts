import { defineConfig } from 'vitest/config';

/**
 * 纯 Node 侧配置计算，不需要 DOM：
 * 断言的是「给定 env / package.json，产出的 Vite 配置长什么样」。
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    name: 'vite-config',
  },
});
