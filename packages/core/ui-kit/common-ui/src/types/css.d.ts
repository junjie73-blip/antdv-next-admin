/**
 * `vue-sonner/style.css` 是纯副作用导入（toaster 的基础样式），包里没有配套的类型声明，
 * TS 会报 TS2882「找不到模块或类型声明」。与 `popup-ui/src/types/css.d.ts` 同一套路：
 * 给一个环境模块声明，让"入口是 CSS"这种约定在类型层面成立。
 *
 * 只声明这一个外部模块。本组件自己的覆写规则写在 `toast/Toaster.vue` 的 `<style>` 里，
 * SFC 的样式块由编译器处理，不经过 TS。
 */
declare module 'vue-sonner/style.css';
