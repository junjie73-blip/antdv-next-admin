import { defineConfig } from 'tsdown'

/**
 * 纯类型包也走 rolldown 产出 d.ts：
 * 消费方（apps/web 与 apps/backend-mock）只依赖 dist，
 * 不需要把 src 目录结构暴露出去。
 */
export default defineConfig({
  clean: true,
  dts: true,
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'es2022',
})
