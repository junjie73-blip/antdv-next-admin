/**
 * common-ui 以「源码」形式被应用侧 Vite 直接消费（package.json main 指向 src），
 * 所以 `import.meta.env.*` 会在应用打包时被静态替换，运行期行为正确。
 * 但本包 tsconfig 的 `types` 未引入 `vite/client`（vite 不是本包依赖），
 * 这里补一份最小环境类型声明，仅为让 `import.meta.env.DEV` 通过类型检查。
 */
interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly MODE: string;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
