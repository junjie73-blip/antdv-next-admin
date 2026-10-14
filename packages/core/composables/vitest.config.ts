import { defineConfig } from 'vitest/config';

/**
 * happy-dom：被测的是 EventManager、状态机、分片调度、打印 DOM 操作这类轻量逻辑，
 * 不需要真实浏览器；WebSocket / EventSource 由测试自己注入假实现。
 */
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['__tests__/**/*.test.ts'],
    name: 'composables',
  },
});
