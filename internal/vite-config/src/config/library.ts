import type { PluginOption, UserConfig } from 'vite';

import { join } from 'node:path';

import { defineConfig, mergeConfig } from 'vite';

import { createPlugins } from '../plugins';
import { loadEnv } from '../utils/env';
import { readPackageJson, resolveLibExternals } from '../utils/package-json';
import { createCommonConfig } from './common';

export interface LibraryOptions {
  /** 入口，默认 `src/index.ts`；多入口传对象 */
  entry?: Record<string, string> | string;
  /** 产物文件名前缀，默认取 package.json 的 name 尾段 */
  fileName?: string;
  formats?: ('cjs' | 'es' | 'iife' | 'umd')[];
  /** UMD / IIFE 的全局变量名 */
  name?: string;
  /** 追加 external（默认已把 dependencies + peerDependencies 全排除） */
  external?: string[];
  /** 是否生成 .d.ts，默认 true */
  dts?: boolean;
  /** 消费方根目录，默认 `process.cwd()` */
  root?: string;
  /** 最后一层深合并 */
  overrides?: UserConfig;
  /** 追加插件 */
  plugins?: PluginOption[];
}

/**
 * 组件库 / 工具库的 lib 模式配置。
 *
 * 与 `tsdown` 的分工：纯 TS 包（shared / preferences / router / directives）用
 * tsdown 打包，快且不需要 vite；需要编译 SFC、样式或资源资产的包（例如 @antdv/ui
 * 的 .vue 组件）走这里。
 */
export function defineLibraryConfig(options: LibraryOptions = {}) {
  return defineConfig(async ({ mode }) => {
    const root = options.root ?? process.cwd();
    const envConfig = loadEnv(mode);
    const pkg = readPackageJson(root);

    const library: UserConfig = {
      build: {
        copyPublicDir: false,
        // 库产物要能被再次 tree-shake，压缩与 sourcemap 交给消费方
        minify: false,
        rolldownOptions: {
          external: resolveLibExternals(pkg, options.external),
        },
        sourcemap: false,
        lib: {
          entry: options.entry ?? join(root, 'src/index.ts'),
          fileName: options.fileName ?? (pkg.name ?? 'index').split('/').pop(),
          formats: options.formats ?? ['es'],
          name: options.name,
        },
      },
      plugins: [
        // 编译链（Vue / 自动导入 / SVG / 样式）与 .d.ts 都由共享插件层给出，
        // 这里只追加消费方自己的插件
        ...(await createPlugins(mode, {
          dts: options.dts,
          kind: 'library',
          root,
        })),
        ...(options.plugins ?? []),
      ],
    };

    return mergeConfig(
      createCommonConfig({ envConfig, mode, root }),
      mergeConfig(library, options.overrides ?? {}),
    );
  });
}
