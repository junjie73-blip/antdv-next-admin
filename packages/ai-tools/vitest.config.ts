import { defineConfig } from 'vitest/config';

/** 纯函数工具包，无需 DOM 与 Vue 插件。 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['__tests__/**/*.test.ts'],
    name: 'ai-tools',
  },
});
