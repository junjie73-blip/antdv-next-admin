import { defineConfig } from 'tsdown';

/**
 * 每个模块一个入口，配合 package.json 的 `"./*"` 通配符：
 * `@antdv/layouts` 与 `@antdv/layouts/modes` 都能解析到对应 dist 文件。
 *
 * platform 用 neutral：产物给浏览器打包器消费，
 * 但 build 阶段由 Node 上的 rolldown 执行，写 browser 会让部分 polyfill 判定介入。
 */
export default defineConfig({
  clean: true,
  dts: true,
  entry: ['src/index.ts', 'src/*.ts'],
  format: ['esm'],
  platform: 'neutral',
  target: 'es2022',
});
