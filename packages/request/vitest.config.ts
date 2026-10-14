import { defineConfig } from 'vitest/config';

/**
 * happy-dom：forceLogout 要改 `location.hash`，executor 的用例要假 fetch 响应，
 * 这些都不需要完整浏览器。
 */
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['__tests__/**/*.spec.ts'],
    name: 'request',
  },
});
