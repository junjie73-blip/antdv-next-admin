import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

/**
 * 子包直出 SFC 源码（tsdown 不编译 .vue，产物形态交给消费方的 vite），
 * 所以测试环境自己挂 `@vitejs/plugin-vue`：
 * 这样"包能不能被任意 vue 工程直接消费"这件事，在包内就被验证掉了。
 */
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['__tests__/**/*.test.ts'],
    name: 'ui',
  },
});
