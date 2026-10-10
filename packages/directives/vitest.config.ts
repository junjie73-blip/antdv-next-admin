import { defineConfig } from 'vitest/config';

/**
 * happy-dom：指令要往真实元素上写 class / style / attribute，
 * 需要 DOM，但不需要完整浏览器。
 * IntersectionObserver 等能力由测试注入假实现，包内不直接依赖浏览器全局。
 */
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['__tests__/**/*.test.ts'],
    name: 'directives',
  },
});
