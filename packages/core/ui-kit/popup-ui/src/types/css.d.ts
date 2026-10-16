/**
 * `vue-sonner/style.css` 是纯副作用导入（Toaster 的样式），包里没有配套的类型声明，
 * TS 会报 TS2882「找不到模块或类型声明」。与 `apps/web/types/antdv-design.d.ts` 同一套路：
 * 给一个环境模块声明，让"入口是 CSS"这种约定在类型层面成立。
 */
declare module 'vue-sonner/style.css';
