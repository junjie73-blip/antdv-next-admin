import { readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import * as barrel from '../src/index';
import pkg from '../package.json';

const srcDir = path.resolve(import.meta.dirname, '../src');

/**
 * 这个包的定位是"两类纯函数"：菜单（menu）与 DOM 落地（css-vars / theme-mode）。
 * 想再加第三个目录时先确认它真的不需要 pinia / vue-router 运行时——需要就该去别的包。
 */
describe('utils 目录结构', () => {
  it('src 根只有约定的四个文件', () => {
    const files = readdirSync(srcDir)
      .filter((name) => name.endsWith('.ts'))
      .toSorted();

    expect(files).toEqual([
      'css-vars.ts',
      'index.ts',
      'menu.ts',
      'theme-mode.ts',
    ]);
  });

  it('root barrel 三类能力各导出一个代表', () => {
    for (const name of [
      'applyPreferencesToDom',
      'clearPreferencesFromDom',
      'createSystemDark',
      'menuKeyOf',
      'resolveThemeMode',
    ]) {
      expect(barrel).toHaveProperty(name);
    }
  });

  it('三个模块都有可导入的子路径', () => {
    const declared = Object.keys(pkg.exports as Record<string, unknown>);
    for (const subpath of ['./css-vars', './menu', './theme-mode']) {
      expect(declared).toContain(subpath);
    }
  });

  it('菜单只用 vue-router 的类型，不把它变成运行时依赖', () => {
    const deps = (pkg.dependencies ?? {}) as Record<string, string>;
    expect(deps['vue-router']).toBeUndefined();
  });
});
