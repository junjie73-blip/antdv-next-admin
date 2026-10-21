/**
 * vue-cropper 的 `typings` 指向 `lib/typings/index.d.ts`，那份声明里 `import ../index`
 * 又落到 `lib/index.ts`，而 `lib/index.ts` 第一行就是 `import VueCropper from './vue-cropper.vue'`
 * —— 包没随产物发布 `.vue` 的配套声明，于是这条相对导入报 TS7016「隐式 any」，
 * 并把整棵 `lib/` 拉进本包的 program 里检查（`skipLibCheck` 只对 `.d.ts` 有效，救不了它）。
 *
 * 修法只补那一个缺失的模块：星号 + 斜杠 + `vue-cropper.vue` 这条通配，
 * 与 `*.css` 属于同一套「相对路径解析失败时按通配兜底」的机制。
 *
 * 不要顺手写成匹配任意 `.vue`：本包自己的 SFC 靠真实类型，
 * 通配一旦抢先，`import X from './X.vue'` 的 props 就全成了 `any`。
 * （宿主 `apps/web` 那份 `types/env.d.ts` 里确实有宽到任意 `.vue` 的兜底，
 * 所以同样的错在应用侧看不到 —— 应用把包源码并进自己 program 时用的是它那份声明。）
 */
declare module '*/vue-cropper.vue';
