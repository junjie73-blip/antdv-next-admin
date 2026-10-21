import type { TsdownPlugin } from 'tsdown';

import { defineConfig } from 'tsdown';

/**
 * 子包用 rolldown（tsdown 是它的打包 CLI）产出 dist + d.ts：
 * 应用侧 `vite.config.ts` 直接 import 包名，不再穿透到源码目录，
 * 这样 internal / packages 才能被多个 app 复用而不产生相对路径耦合。
 */
export default defineConfig({
  clean: true,
  dts: true,
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  plugins: [rawImports()],
  target: 'node22',
  /*
   * `.html` 按纯文本编译，配合下面的 rawImports() 支持 `import x from './a.html?raw'`。
   *
   * app-loading 的默认模板住在 `src/plugins/app-loading/defaults/loading.html` ——
   * 模板本体是 HTML 文件，不是 TS 里的反引号字符串：改起来有语法高亮，也不会被
   * 格式化器把整段折成一坨。它被内联成字符串常量而不是运行时读文件，因为产物是
   * 单个 dist/index.mjs，旁边没有 defaults/ 目录，`__dirname` 读取必然 ENOENT。
   */
  loader: { '.html': 'text' },
});

/**
 * rolldown 1.2 在 Windows 上不会把 `?raw` 当查询剥掉，而是连 `?raw` 一起当文件名去
 * open，直接 `UNLOADABLE_DEPENDENCY (os error 123)`；Vite 侧则原生支持这个后缀。
 * 所以这里只补"剥掉查询再解析"这一步，读成字符串交给上面的 `loader` 配置。
 */
function rawImports(): TsdownPlugin {
  return {
    name: 'vite-config:raw-imports',

    async resolveId(id, importer) {
      if (!id.endsWith('?raw')) return null;
      const resolved = await this.resolve(
        id.slice(0, -'?raw'.length),
        importer,
        {
          skipSelf: true,
        },
      );
      // 解析不到就交回默认链路，让报错停在真正的缺失点上
      return resolved?.id ?? null;
    },
  };
}
