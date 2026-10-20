import type { PluginOption, UserConfig } from 'vite';

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { defineConfig, mergeConfig } from 'vite';
import { globSync } from 'tinyglobby';

import { createPlugins } from '../plugins';
import { loadEnv } from '../utils/env';
import { readPackageJson, resolveLibExternals } from '../utils/package-json';
import { createCommonConfig } from './common';

export interface LibraryOptions {
  /**
   * 入口，默认从 `package.json` 的 `exports` 映射推导（含 `./*` 通配）。
   * 显式传值时跳过推导。
   */
  entry?: Record<string, string> | string;
  /** 产物名模板（进 `output.entryFileNames`），默认 `[name]` = `exports` 子路径 */
  fileName?: string;
  formats?: ('cjs' | 'es' | 'iife' | 'umd')[];
  /** UMD / IIFE 的全局变量名 */
  name?: string;
  /** 追加 external（默认已把 dependencies + peerDependencies 全排除） */
  external?: string[];
  /**
   * 是否生成 .d.ts。默认跟随 `package.json` 的 `types` 指向：
   * 指向 `dist` 才生成 —— 按源码发布的包（`types: ./src/index.ts`）没有读者，
   * 类型面由各自的 `type-check`（vue-tsc）把关，重复出一份 `.d.ts` 只是把构建
   * 时间翻倍（实测 `@antdv/menu-ui` 27 s → 7.5 s）。
   */
  dts?: boolean;
  /** 消费方根目录，默认 `process.cwd()` */
  root?: string;
  /** 最后一层深合并 */
  overrides?: UserConfig;
  /** 追加插件 */
  plugins?: PluginOption[];
}

const TS_EXT = '(ts|tsx|mts|cts)';

/** 入口源文件统一成「相对 `src`」的正斜杠路径，Windows 传反斜杠也能用 */
function normalizeSource(path: string): string {
  return path.replaceAll('\\', '/').replace(/^(\.\/)?(src\/)?/, '');
}

/** `exports` 的值可能是字符串，也可能是 `{ types, import, default }` 条件对象 */
function exportTarget(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const variants = Object.values(value as Record<string, unknown>);
    return variants.find(
      (item): item is string =>
        typeof item === 'string' && /\.(tsx?|vue|mts|cts)$/.test(item),
    );
  }
  return undefined;
}

/** `./a/b` → `a/b`；`.` → `index` */
function subpathToEntryName(subpath: string): string {
  return subpath === '.' ? 'index' : subpath.replace(/^\.\//, '');
}

export interface LibEntry {
  /** `exports` 里的子路径，用于报错信息 */
  specifier: string;
  /** 产物名（`dist/<name>.js`） */
  name: string;
  /** 相对 `src` 的源文件，用于推导 `.d.ts` 落点 */
  source: string;
}

/**
 * 从 `exports` 映射推导 lib 入口。
 *
 * 为什么不直接写死 `src/index.ts`：这些包的公共面就是 `exports`，入口跟着它走
 * 才能做到「加一个子路径导出，构建自动覆盖到它」；反过来漏了入口的症状是
 * 构建照样绿，但消费方 `import '@antdv/x/new-subpath'` 时产物里根本没有。
 * `./*` 这类通配按 `exports` 自己的模式去 glob，不额外猜目录结构。
 */
export function resolveLibraryEntries(
  root: string,
  pkg: Record<string, unknown>,
): LibEntry[] {
  const exports = pkg.exports;
  const entries = new Map<string, LibEntry>();
  const add = (specifier: string, target: string) => {
    const relative = target.replaceAll('\\', '/').replace(/^\.\//, '');
    // 只认 src 下的源文件：产物入口与 .d.ts 落点都以 `src` 为根，
    // 指向 src 之外的子路径（预编译产物等）不在统一构建的覆盖范围里。
    if (!relative.startsWith('src/')) return;
    if (!existsSync(join(root, relative))) return;
    const source = relative.slice('src/'.length);
    const name = subpathToEntryName(specifier);
    entries.set(name, { name, source, specifier });
  };

  if (exports && typeof exports === 'object') {
    for (const [specifier, value] of Object.entries(
      exports as Record<string, unknown>,
    )) {
      if (specifier === './package.json') continue;
      const target = exportTarget(value);
      if (!target) continue;
      if (!target.includes('*')) {
        add(specifier, target);
        continue;
      }
      // 通配：把 exports 的模式当成 glob，取匹配到的每个源文件
      const matched = globSync([target.replace(/^\.\//, '')], {
        cwd: root,
        dot: false,
      });
      for (const file of matched.toSorted()) {
        // `./src/*.ts` 命中的文件按同样的相对位置还原子路径
        const tail = file
          .replace(/^src\//, '')
          .replace(new RegExp(`\\.${TS_EXT}$`), '');
        add(specifier.replace(/\*$/, tail), `./${file}`);
      }
    }
  }

  if (entries.size === 0) {
    entries.set('index', {
      name: 'index',
      source: 'index.ts',
      specifier: '.',
    });
  }
  return [...entries.values()];
}

/**
 * 构建后校验产物：`exports` 里每个入口都要有对应的 JS（样式入口则是 CSS），
 * 开了 dts 还要有 `.d.ts`。
 *
 * 这层校验是"统一构建标准"里唯一能自动兜住的部分 —— 子包平时按源码被消费，
 * `dist` 没人读，编译失败或入口漏配只会悄悄留一份残缺产物，构建照样绿。
 */
const STYLE_EXT = /\.(css|scss|sass|less)$/;

/** 入口应有的产物（相对 `dist`） */
export function expectedArtifacts(entry: LibEntry, dts: boolean): string[] {
  const isStyle = STYLE_EXT.test(entry.source);
  const out = [`${entry.name}.${isStyle ? 'css' : 'js'}`];
  if (dts && !isStyle) {
    out.push(entry.source.replace(new RegExp(`\\.${TS_EXT}$`), '.d.ts'));
  }
  return out;
}

export function createValidateDistPlugin(
  root: string,
  entries: LibEntry[],
  dts: boolean,
): PluginOption {
  return {
    name: 'antdv:validate-dist',
    apply: 'build',
    enforce: 'post',
    writeBundle(_, bundle) {
      const names = new Set(Object.keys(bundle));
      const missing: string[] = [];
      for (const entry of entries) {
        for (const artifact of expectedArtifacts(entry, dts)) {
          if (names.has(artifact) && existsSync(join(root, 'dist', artifact)))
            continue;
          missing.push(`${entry.specifier} → dist/${artifact}`);
        }
      }
      if (missing.length > 0) {
        this.error(
          `构建产物不完整：\n${missing.map((m) => `  - ${m}`).join('\n')}`,
        );
      }
    },
  };
}

/**
 * 入口来源优先级：显式 `entry` > `exports` 推导 > `src/index.ts` 兜底。
 * 显式 `entry` 是字符串时按单入口对待（产物名 `index`），是映射时 key 即产物名。
 */
function resolveEntries(
  root: string,
  pkg: Record<string, unknown>,
  options: LibraryOptions,
): LibEntry[] {
  const entry = options.entry;
  if (!entry) return resolveLibraryEntries(root, pkg);
  if (typeof entry === 'string') {
    return [{ name: 'index', source: normalizeSource(entry), specifier: '.' }];
  }
  return Object.entries(entry).map(([name, source]) => ({
    name,
    source: normalizeSource(source),
    specifier: `./${name}`,
  }));
}

/**
 * 组件库 / 工具库的 lib 模式配置，子包统一构建标准走的就是这里。
 *
 * 与 `tsdown` 的分工：`internal/*` 与已经按 dist 发布的基座包（shared / preferences /
 * router / directives / hooks / types）继续用 tsdown —— 它们只打给自己 workspace
 * 消费，产物即消费面。`packages/**` 里那些"按源码发布、但必须有完整构建"的子包走这里：
 * 入口从 `exports` 推导、SFC 与样式有编译链、`.d.ts` 落点固定，最后由
 * `antdv:validate-dist` 校验产物真的覆盖到每一个公共子路径。
 * 插件链只取最小编译链（`kind: 'library'`），不掺应用侧机器，理由见 plugins/index.ts。
 */
export function defineLibraryConfig(options: LibraryOptions = {}) {
  return defineConfig(async ({ mode }) => {
    const root = options.root ?? process.cwd();
    const envConfig = loadEnv(mode);
    const pkg = readPackageJson(root);
    const typesFromDist = String(pkg.types ?? '').includes('/dist/');
    const dts = options.dts ?? typesFromDist;

    const inferred = !options.entry;
    const entries = resolveEntries(root, pkg, options);

    const libEntry: Record<string, string> = Object.fromEntries(
      entries.map((entry) => [
        entry.name,
        // 推导出来的 source 相对 `src`；显式 entry 原样交给 Vite（相对 root 或绝对路径）
        join(root, 'src', entry.source),
      ]),
    );

    const library: UserConfig = {
      build: {
        copyPublicDir: false,
        emptyOutDir: true,
        // 库产物要能被再次 tree-shake，压缩与 sourcemap 交给消费方
        minify: false,
        rolldownOptions: {
          external: resolveLibExternals(pkg, options.external),
          /**
           * 多入口 lib 的产物名由 output 模板决定（Vite 官方口径），不能用
           * `lib.fileName` —— 它是单入口的前缀选项，写成 `'[name]'` 字符串时
           * CSS 资产不走同一个替换，会落成 `dist/_name_.css`；写成函数时
           * JS 又被塞进 `dist/es/`。
           */
          output: {
            assetFileNames: '[name].[ext]',
            entryFileNames: `${options.fileName ?? '[name]'}.js`,
          },
        },
        sourcemap: false,
        lib: {
          entry: inferred
            ? libEntry
            : (options.entry as Record<string, string> | string),
          formats: options.formats ?? ['es'],
          name: options.name,
        },
      },
      plugins: [
        // 编译链（Vue / JSX / 样式）与 .d.ts 都由共享插件层给出，
        // 这里只追加消费方自己的插件
        ...(await createPlugins(mode, {
          dts,
          kind: 'library',
          root,
        })),
        createValidateDistPlugin(root, entries, dts),
        ...(options.plugins ?? []),
      ],
    };

    return mergeConfig(
      createCommonConfig({ envConfig, mode, root }),
      mergeConfig(library, options.overrides ?? {}),
    );
  });
}
