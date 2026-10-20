import type { Plugin } from 'vite';

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createValidateDistPlugin,
  expectedArtifacts,
  resolveLibraryEntries,
} from '../src/config/library';

/**
 * 统一构建标准的两条承重墙：入口从 `exports` 推导（`resolveLibraryEntries`），
 * 产物落盘后逐条校验（`expectedArtifacts` + `antdv:validate-dist`）。
 * 少任何一条，"每个子包都有完整 build" 就只是 package.json 里的一行字。
 */

const tempDirs: string[] = [];

/** 造一个最小包：写入 `src` 下的源文件，返回根目录与对应 `exports` */
function makePackage(sources: string[]) {
  const root = mkdtempSync(join(tmpdir(), 'antdv-lib-'));
  tempDirs.push(root);
  const exports: Record<string, unknown> = {};
  for (const source of sources) {
    const file = join(root, 'src', source);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, 'export const ok = 1;\n', 'utf8');
    exports[source === 'index.ts' ? '.' : `./${subpath(source)}`] =
      `./src/${source}`;
  }
  exports['./package.json'] = './package.json';
  return { exports, root };
}

/** `sse/index.ts` 的公共子路径是 `./sse`，`menu.ts` 的是 `./menu` */
function subpath(source: string) {
  return source.replace(/\/index\.ts$/, '').replace(/\.ts$/, '');
}

function writeDist(root: string, artifacts: string[]) {
  for (const artifact of artifacts) {
    const file = join(root, 'dist', artifact);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, '', 'utf8');
  }
}

/**
 * 直接驱动 writeBundle 钩子：`this.error` 换成 throw 才能断言报错文案。
 * 产物表与磁盘都要满足 —— 校验器同时查这两处（前者防漏打包，后者防空产物）。
 */
function runValidate(
  root: string,
  entries: ReturnType<typeof resolveLibraryEntries>,
  dts: boolean,
  bundleFiles: string[],
) {
  const plugin = createValidateDistPlugin(root, entries, dts) as Plugin;
  const bundle = Object.fromEntries(bundleFiles.map((f) => [f, {}]));
  (plugin.writeBundle as (this: unknown, _: unknown, b: unknown) => void).call(
    {
      error(message: string) {
        throw new Error(message);
      },
    },
    {},
    bundle,
  );
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true });
  }
});

describe('resolveLibraryEntries', () => {
  it('入口跟着 exports 走：命名子路径各成一个产物', () => {
    const { exports, root } = makePackage([
      'index.ts',
      'menu.ts',
      'theme-mode.ts',
    ]);
    expect(resolveLibraryEntries(root, { exports })).toEqual([
      { name: 'index', source: 'index.ts', specifier: '.' },
      { name: 'menu', source: 'menu.ts', specifier: './menu' },
      {
        name: 'theme-mode',
        source: 'theme-mode.ts',
        specifier: './theme-mode',
      },
    ]);
  });

  it('目录型子路径产物名与 .d.ts 落点都带目录', () => {
    const { exports, root } = makePackage(['index.ts', 'sse/index.ts']);
    expect(resolveLibraryEntries(root, { exports })).toEqual([
      { name: 'index', source: 'index.ts', specifier: '.' },
      { name: 'sse', source: 'sse/index.ts', specifier: './sse' },
    ]);
  });

  it('`./*` 通配按实际文件展开', () => {
    const root = mkdtempSync(join(tmpdir(), 'antdv-lib-'));
    tempDirs.push(root);
    mkdirSync(join(root, 'src'), { recursive: true });
    for (const file of ['a.ts', 'b.ts', 'index.ts']) {
      writeFileSync(join(root, 'src', file), '', 'utf8');
    }
    const entries = resolveLibraryEntries(root, {
      exports: { './*': './src/*.ts', './package.json': './package.json' },
    });
    expect(entries.map((entry) => entry.name)).toEqual(['a', 'b', 'index']);
    for (const entry of entries) {
      expect(existsSync(join(root, 'src', entry.source))).toBe(true);
    }
  });

  it('只认 src 下的源文件：按 dist 发布的包不会被误接成 lib 入口', () => {
    const { root } = makePackage(['index.ts']);
    // 没有一个子路径落在 src 下 → 退回 index，产物校验只查 dist/index.js
    expect(
      resolveLibraryEntries(root, {
        exports: {
          '.': { default: './dist/index.js', types: './dist/index.d.ts' },
          './*': { default: './dist/*.js', types: './dist/*.d.ts' },
          './package.json': './package.json',
        },
      }),
    ).toEqual([{ name: 'index', source: 'index.ts', specifier: '.' }]);
  });

  it('源文件不存在时不生成入口（否则校验器只会报一个无法修复的缺失）', () => {
    const { exports, root } = makePackage(['index.ts']);
    exports['./ghost'] = './src/ghost.ts';
    expect(
      resolveLibraryEntries(root, { exports }).map((entry) => entry.name),
    ).toEqual(['index']);
  });

  it('没有 exports 时退回 src/index.ts', () => {
    expect(resolveLibraryEntries('/pkg', {})).toEqual([
      { name: 'index', source: 'index.ts', specifier: '.' },
    ]);
  });
});

describe('expectedArtifacts', () => {
  it('脚本入口：JS 产物 + 开 dts 时的 .d.ts（相对 src，与 entryRoot 对齐）', () => {
    expect(
      expectedArtifacts(
        { name: 'sse', source: 'sse/index.ts', specifier: './sse' },
        true,
      ),
    ).toEqual(['sse.js', 'sse/index.d.ts']);
    expect(
      expectedArtifacts(
        { name: 'index', source: 'index.ts', specifier: '.' },
        false,
      ),
    ).toEqual(['index.js']);
  });

  it('样式入口只有 CSS，不要求 .d.ts', () => {
    expect(
      expectedArtifacts(
        { name: 'index', source: 'index.css', specifier: '.' },
        true,
      ),
    ).toEqual(['index.css']);
  });
});

describe('antdv:validate-dist', () => {
  it('产物齐全时放行', () => {
    const { exports, root } = makePackage(['index.ts', 'menu.ts']);
    const entries = resolveLibraryEntries(root, { exports });
    writeDist(root, ['index.js', 'menu.js']);
    expect(() =>
      runValidate(root, entries, false, ['index.js', 'menu.js']),
    ).not.toThrow();
  });

  it('漏了入口就让构建失败，并点名是哪个公共子路径', () => {
    const { exports, root } = makePackage(['index.ts', 'menu.ts']);
    const entries = resolveLibraryEntries(root, { exports });
    writeDist(root, ['index.js']);
    expect(() => runValidate(root, entries, false, ['index.js'])).toThrow(
      /menu → dist\/menu\.js/,
    );
  });

  it('产物表里有名字但磁盘上没有文件，同样算失败', () => {
    const { exports, root } = makePackage(['index.ts']);
    const entries = resolveLibraryEntries(root, { exports });
    expect(() => runValidate(root, entries, false, ['index.js'])).toThrow(
      /构建产物不完整/,
    );
  });

  it('开了 dts 就一并校验声明文件落点', () => {
    const { exports, root } = makePackage(['index.ts', 'sse/index.ts']);
    const entries = resolveLibraryEntries(root, { exports });
    writeDist(root, ['index.js', 'index.d.ts', 'sse.js']);
    expect(() =>
      runValidate(root, entries, true, ['index.js', 'index.d.ts', 'sse.js']),
    ).toThrow(/sse → dist\/sse\/index\.d\.ts/);
  });
});
