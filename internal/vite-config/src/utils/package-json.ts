import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import dayjs from 'dayjs';

export interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  name?: string;
  peerDependencies?: Record<string, string>;
  version?: string;
  [key: string]: unknown;
}

/**
 * 读消费方（app / 子包）自己的 package.json。
 *
 * 用 fs 而不是 `import pkg from './package.json'`：配置代码在包内，
 * 而 package.json 在应用目录里 —— 静态 import 会把「哪个包」写死在编译期。
 */
export function readPackageJson(root: string): PackageJson {
  try {
    return JSON.parse(
      readFileSync(join(root, 'package.json'), 'utf8'),
    ) as PackageJson;
  } catch {
    // 读不到不该让构建挂掉：元信息缺失只是少一份 __APP_INFO__
    return {};
  }
}

export interface AppInfo {
  lastBuildTime: string;
  pkg: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    name?: string;
    version?: string;
  };
}

/** 注入到 `__APP_INFO__` 的构建元信息（关于页展示版本与构建时间） */
export function createAppInfo(root: string, now = new Date()): AppInfo {
  const pkg = readPackageJson(root);
  return {
    lastBuildTime: dayjs(now).format('YYYY-MM-DD HH:mm:ss'),
    pkg: {
      dependencies: pkg.dependencies,
      devDependencies: pkg.devDependencies,
      name: pkg.name,
      version: pkg.version,
    },
  };
}

/**
 * 库模式的 external 清单：dependencies + peerDependencies 的包名。
 *
 * 这些包不该被打进产物 —— 打进来会带第二份 vue / antdv-next，
 * 体积爆炸且响应式系统会分裂。前缀匹配交给 vite 的 `external` 函数处理。
 */
export function resolveLibExternals(
  pkg: PackageJson,
  extra: string[] = [],
): string[] {
  const names = [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
  ];
  return [...new Set([...names, ...extra])].toSorted();
}
