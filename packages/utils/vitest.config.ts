import { defineConfig } from 'vitest/config';

/**
 * happy-dom：css-vars 要往 documentElement 写 CSS 变量、theme-mode 要探测 matchMedia，
 * menu 一侧全是纯函数，三种用例都不需要完整浏览器。
 */
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['__tests__/**/*.test.ts'],
    name: 'utils',
  },
});
