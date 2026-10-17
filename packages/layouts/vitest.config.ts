import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

/**
 * 多数用例是纯计算（菜单树 → 区域开关 / 面包屑 / 宽度样式），但外壳装配、面包屑
 * 与形态示意图是 SFC，需要 plugin-vue + DOM。统一用 jsdom，纯函数用例照跑不误；
 * `test/setup.ts` 补齐 jsdom 缺的观察器与 `matchMedia`（见那边的说明）。
 */
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['__tests__/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
    name: 'layouts',
  },
});
