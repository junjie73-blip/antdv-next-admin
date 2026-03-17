import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import { defineConfig as defineViteConfig } from 'vite'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig as Parameters<typeof mergeConfig>[0],
  defineConfig({
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
