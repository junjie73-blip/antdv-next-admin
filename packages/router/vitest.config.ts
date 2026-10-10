import { defineConfig } from 'vitest/config';

/**
 * happy-dom：偏好设置要往 documentElement 上写 CSS 变量、指令要操作真实 DOM，
 * 但不需要完整浏览器；外部能力（localStorage 之外的浏览器 API）由测试注入假实现。
 */
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['__tests__/**/*.test.ts'],
    name: 'router',
  },
});
