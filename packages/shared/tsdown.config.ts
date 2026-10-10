import { defineConfig } from 'tsdown';

/**
 * 每个工具模块一个入口，配合 package.json 的 `"./*"` 通配符：
 * `@antdv/shared/cn` 与 `@antdv/shared` 都能解析到对应 dist 文件。
 *
 * 分入口而不是把一切塞进单文件：调用方只 import 一个 `cn` 时，
 * 不该把 xlsx / dompurify 的初始化代码一起拖进图里（tree-shaking 之前先少加载）。
 *
 * platform 用 neutral：产物给浏览器打包器消费，
 * 但 build 阶段由 Node 上的 rolldown 执行，写 browser 会让部分 polyfill 判定介入。
 */
export default defineConfig({
  clean: true,
  dts: true,
  entry: ['src/index.ts', 'src/*.ts', 'src/*/index.ts'],
  format: ['esm'],
  platform: 'neutral',
  target: 'es2022',
});
