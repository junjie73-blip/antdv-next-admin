import { defineLibraryConfig } from '@antdv/vite-config';

/**
 * 样式包没有 JS 公共面：入口只有 `src/index.css`，它 `@import` 齐 token 与 css 两侧，
 * 所以打这一份就等于把整个级联（含 `@apply`、`@theme`、`@source` 登记）编译一遍。
 * `./*` 那些子路径导出指向同一批源文件，不需要各自成入口。
 */
export default defineLibraryConfig({
  dts: false,
  entry: 'src/index.css',
  // lib 模式默认 cssCodeSplit: false，而这种模式下 Vite 直接拒绝 CSS 入口
  overrides: { build: { cssCodeSplit: true } },
});
