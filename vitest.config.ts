import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'e2e/**'],
    root: fileURLToPath(new URL('./', import.meta.url)),
    // 全局注入
    globals: true,
    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/components/**/*.vue',
        'src/composables/**/*.ts',
        'src/utils/**/*.ts',
        'src/stores/**/*.ts',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/types/**',
        '**/node_modules/**',
        '**/*.spec.ts',
        '**/*.test.ts',
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '#': fileURLToPath(new URL('./types', import.meta.url)),
    },
  },
})
