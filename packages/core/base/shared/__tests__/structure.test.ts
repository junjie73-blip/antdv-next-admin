import { readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import * as barrel from '../src/index';
import pkg from '../package.json';

const srcDir = path.resolve(import.meta.dirname, '../src');

/**
 * 目录划分是包边界的一部分：`cache` / `color` / `constants` / `utils` 四个目录
 * 加一个 `store.ts` 出口。新增模块时要先想清楚归到哪一格，而不是在 src 根下
 * 再摊一个孤立文件。
 */
describe('shared 目录结构', () => {
  it('src 根只允许约定的目录与两个入口', () => {
    const entries = readdirSync(srcDir, { withFileTypes: true })
      .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
      .toSorted();

    expect(entries).toEqual([
      'cache/',
      'color/',
      'constants/',
      'index.ts',
      'store.ts',
      'utils/',
    ]);
  });

  it('root barrel 导出的正是这几个模块', () => {
    // cache 的 createCache、color 的 parseColor、constants 的 PREFERENCE_CSS_VARS、
    // utils 的 cn、store 的 useStore 各取一个代表
    for (const name of [
      'createCache',
      'parseColor',
      'PREFERENCE_CSS_VARS',
      'cn',
      'useStore',
    ]) {
      expect(barrel).toHaveProperty(name);
    }
  });

  it('多文件目录模块在 exports 里显式列出（通配符不解析 index）', () => {
    const declared = Object.keys(pkg.exports as Record<string, unknown>);
    for (const subpath of [
      './cache',
      './color',
      './constants',
      './utils',
      './utils/crypto',
      './utils/event',
    ]) {
      expect(declared, subpath).toContain(subpath);
    }
  });

  it('utils 下的每个模块都是一个可导入的扁平文件', () => {
    const files = readdirSync(`${srcDir}/utils`)
      .filter((f) => f.endsWith('.ts'))
      .toSorted();

    expect(files).toEqual([
      'cn.ts',
      'csrf.ts',
      'dayjs.ts',
      'domUtils.ts',
      'download.ts',
      'env.ts',
      'excel.ts',
      'file-category.ts',
      'iframe.ts',
      'index.ts',
      'jwt.ts',
      'masking.ts',
      'radius.ts',
      'scroll.ts',
      'template.ts',
      'xss.ts',
    ]);
  });
});
