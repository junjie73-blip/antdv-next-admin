import { defineLibraryConfig } from '@antdv/vite-config';

/**
 * 样式包没有 JS 公共面：入口只有 `src/index.css`，它 `@import` 齐 token 与 css 两侧，
 * 所以打这一份就等于把整个级联（含 `@apply`、`@theme`、层级顺序）编译一遍。
 * `./*` 那些子路径导出指向同一批源文件，不需要各自成入口。
 *
 * 这里原来还有一行 `overrides: { build: { cssCodeSplit: true } }`（lib 模式默认 false，
 * 而该模式下 Vite 直接拒绝 CSS 入口）。现在这条由 `defineLibraryConfig` 按入口形态统一给出，
 * 见 `internal/vite-config/src/config/library.ts` —— 内容登记随包走后，十几个包都多了
 * `./style.css` 这个 CSS 出口，不该让每个包各抄一遍同一个开关。
 *
 * 各子包的内容登记（`@source`）也不在本包里：它随包走，由应用侧的样式装配入口收进同一个 root。
 */
export default defineLibraryConfig({
  dts: false,
  entry: 'src/index.css',
});
