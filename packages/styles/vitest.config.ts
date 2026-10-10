import { defineConfig } from 'vitest/config';

/**
 * 纯 CSS 包，测试只是读文件做文本断言，不需要 DOM 环境。
 * node 环境启动最快，也避免把 happy-dom 变成这个包的隐式依赖。
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['__tests__/**/*.test.ts'],
    name: 'styles',
  },
});
