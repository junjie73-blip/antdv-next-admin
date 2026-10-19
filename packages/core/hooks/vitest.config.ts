import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

/**
 * happy-dom：被测的是 EventManager、状态机、分片调度、打印 DOM 操作这类轻量逻辑，
 * 不需要真实浏览器；WebSocket / EventSource 由测试自己注入假实现。
 *
 * 照样挂 plugin-vue：`usePermission` 走真实的 `@antdv/stores`，那条依赖链
 * （stores → request → popup-ui）里牵进了 SFC，不挂就整个文件解析不了。
 */
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    include: ['__tests__/**/*.test.ts'],
    name: 'hooks',
  },
});
