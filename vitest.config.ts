import { fileURLToPath } from 'node:url'

import { configDefaults, defineConfig } from 'vitest/config'

// 不复用 vite.config.ts：它面向构建，含大量插件；单测只需别名与 jsdom 环境
export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)),
      '#': fileURLToPath(new URL('./types', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'e2e/**'],
    root: fileURLToPath(new URL('./', import.meta.url)),
  },
})
