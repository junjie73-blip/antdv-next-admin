/**
 * `@vue-flow/*` 的样式入口是纯副作用导入，包里没配套类型声明，
 * TS 会报「找不到模块或类型声明」。与 `ai-flow-ui` / `common-ui` 的 `css.d.ts` 同一套路。
 *
 * 口径说明：
 * - `@vue-flow/background` 没有 `dist/style.css`（它把样式写在组件里），不要声明一个不存在的入口；
 * - 只声明外部模块。本包组件的类名全部走 Tailwind 工具类 + shadcn token，
 *   不写 `<style>` 块，因此没有需要在此声明的自有 CSS。
 */
declare module '@vue-flow/core/dist/style.css';
declare module '@vue-flow/core/dist/theme-default.css';
declare module '@vue-flow/controls/dist/style.css';
