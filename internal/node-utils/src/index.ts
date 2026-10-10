/**
 * Node 侧共享工具的统一出口。
 *
 * 只给构建脚本、CLI、vite 配置、Nitro 用；浏览器侧一律不许 import 这里，
 * 否则 execa / chalk 会被打进产物。前端运行时工具在 `@antdv/shared`。
 */
export * from './constants';
export * from './date';
export * from './formatter';
export * from './fs';
export * from './git';
export * from './hash';
export * from './monorepo';
export * from './path';
export * from './spinner';

export type { Package } from '@manypkg/get-packages';
export { default as colors } from 'chalk';
export { consola } from 'consola';
/**
 * 只透出 execa 本体：`export * from 'execa'` 会把它导出的模板标签 `$`
 * 一起带出来，和 date 模块的 `$`（dayjs 快捷构造）撞名。
 * 脚本侧目前只用 execa，需要更多时再按需加，避免隐式冲突。
 */
export { execa } from 'execa';

export { default as fs } from 'node:fs/promises';

export { type PackageJson, readPackageJSON } from 'pkg-types';
export { rimraf } from 'rimraf';
