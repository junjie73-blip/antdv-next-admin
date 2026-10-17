import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

/**
 * store 用例只要 pinia + 一个 DOM（tabs 的持久化读 localStorage、route 的菜单覆盖写
 * localStorage），但依赖链里（`@antdv/shared` → 图标、`@antdv/preferences` → 主题）
 * 会牵进 SFC，所以照样挂 plugin-vue；环境统一用 jsdom，纯函数用例照跑不误。
 */
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['__tests__/**/*.test.ts'],
    name: 'stores',
  },
});
