/**
 * `?raw` 导入的类型声明。
 *
 * 默认 loading 模板住在 `plugins/app-loading/defaults/loading.html`：模板本体是 HTML，
 * 不再是 TS 里的反引号字符串。构建期由 tsdown 的 `loader: { raw: 'text' }` 把
 * `?raw` 导入编译成字符串常量内联进 bundle，测试期由 Vite 的同名查询提供同样语义。
 */
declare module '*.html?raw' {
  const content: string;
  export default content;
}
