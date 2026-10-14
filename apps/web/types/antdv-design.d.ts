/**
 * `@antdv/design` 的入口是 Tailwind v4 的 CSS 文件（`src/index.css`），包里只有样式、没有类型声明。
 *
 * `import '@antdv/design'` 是纯副作用导入，但 TS 仍要能为这个模块名找到声明，
 * 否则报 TS2882。这里给一个简写环境模块声明：它没有运行时导出可取，
 * 只是让"入口是 CSS 的子包"这种约定在类型层面成立。
 */
declare module '@antdv/design';
