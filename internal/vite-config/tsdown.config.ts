import { defineConfig } from 'tsdown'

/**
 * 子包用 rolldown（tsdown 是它的打包 CLI）产出 dist + d.ts：
 * 应用侧 `vite.config.ts` 直接 import 包名，不再穿透到源码目录，
 * 这样 internal / packages 才能被多个 app 复用而不产生相对路径耦合。
 */
export default defineConfig({
  clean: true,
  dts: true,
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
})
