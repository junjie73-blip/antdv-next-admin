import { defineConfig } from 'vitest/config';

/**
 * 用 happy-dom 而不是 jsdom：被测的是下载、脱敏、XSS 过滤这类轻量 DOM 逻辑，
 * happy-dom 启动快一个数量级，且 API 覆盖面足够。
 * 真正需要兼容性问题时（历史遗留行为）再单独给某个文件加 jsdom 环境注释。
 */
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['__tests__/**/*.test.ts'],
    name: 'shared',
  },
});
