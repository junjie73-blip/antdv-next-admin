import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import * as manypkg from '@manypkg/get-packages';

import { readTextFileSync } from './fs';
import { findRepoRootSync, toPosixPath } from './path';

const { getPackages: getPackagesFunc, getPackagesSync: getPackagesSyncFunc } =
  manypkg;

/**
 * 仓库视角的包描述：只保留脚本真正会用的字段。
 * 直接用 @manypkg 的 Package 会把 packageJson 整坨带进返回值，
 * 依赖分析、清单打印都在访问它，字段漂移时很难第一时间发现。
 */
export interface WorkspacePackage {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  /** 绝对路径，POSIX 分隔符 */
  dir: string;
  name: string;
  private: boolean;
  version: string;
}

/**
 * 手写解析而不是引 yaml 库：pnpm-workspace.yaml 在这里只读两段
 * （packages 列表与 catalog 映射），加依赖会让构建期工具链变重。
 */
function parseCatalog(yamlText: string): Record<string, string> {
  const catalog: Record<string, string> = {};
  let inside = false;
  for (const rawLine of yamlText.split(/\r?\n/)) {
    const line = rawLine ?? '';
    // 顶层键（无前导缩进）标志着上一段结束
    if (/^\S/.test(line)) {
      inside = /^catalog:\s*$/.test(line);
      continue;
    }
    if (!inside) continue;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf(':');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim().replaceAll(/^["']|["']$/g, '');
    // 去掉行尾注释，值本身不含 '#'（版本号/范围里不会出现）
    const value = trimmed
      .slice(separator + 1)
      .split(/\s+#/)[0]!
      .trim()
      .replaceAll(/^["']|["']$/g, '');
    if (key && value) catalog[key] = value;
  }
  return catalog;
}

function parseWorkspaceGlobs(yamlText: string): string[] {
  const globs: string[] = [];
  let inside = false;
  for (const rawLine of yamlText.split(/\r?\n/)) {
    const line = rawLine ?? '';
    if (/^\S/.test(line)) {
      inside = /^packages:\s*$/.test(line);
      continue;
    }
    if (!inside) continue;
    const trimmed = line.trim();
    if (!trimmed.startsWith('-')) continue;
    const value = trimmed
      .slice(1)
      .trim()
      .replaceAll(/^["']|["']$/g, '');
    if (value) globs.push(value);
  }
  return globs;
}

export interface WorkspaceConfig {
  catalog: Record<string, string>;
  file: string;
  globs: string[];
}

/** 读根 pnpm-workspace.yaml：catalog 版本表 + 包通配符 */
function readWorkspaceConfig(root: string = findRepoRootSync() ?? process.cwd()): WorkspaceConfig {
  const file = existsSync(join(root, 'pnpm-workspace.yaml'))
    ? join(root, 'pnpm-workspace.yaml')
    : join(root, 'pnpm-workspace.yml');
  const text = readTextFileSync(file);
  return {
    catalog: parseCatalog(text),
    file,
    globs: parseWorkspaceGlobs(text),
  };
}

function toWorkspacePackage(pkg: manypkg.Package): WorkspacePackage {
  const {
    dependencies = {},
    devDependencies = {},
    name = '',
    private: isPrivate = false,
    version = '0.0.0',
  } = pkg.packageJson;
  return {
    dependencies,
    devDependencies,
    dir: toPosixPath(pkg.dir),
    name,
    private: Boolean(isPrivate),
    version,
  };
}

/**
 * 列出大仓全部子包（异步）。
 * 走 @manypkg 而不是自己展开通配符：它认 pnpm 的 packages 段，
 * 也处理同名的 workspace 与忽略项，避免两套口径。
 */
async function listWorkspacePackages(
  root: string = findRepoRootSync() ?? process.cwd(),
): Promise<WorkspacePackage[]> {
  const { packages } = await getPackagesFunc(resolve(root));
  return packages.map((pkg) => toWorkspacePackage(pkg));
}

/** 同步版，供构建配置求值阶段使用 */
function listWorkspacePackagesSync(
  root: string = findRepoRootSync() ?? process.cwd(),
): WorkspacePackage[] {
  const { packages } = getPackagesSyncFunc(resolve(root));
  return packages.map((pkg) => toWorkspacePackage(pkg));
}

/**
 * 路径归属哪个包：命中最深的那个。
 * `apps/web` 与 `apps/web/utils` 若都是包，浅匹配先赢会把子包文件算到父包头上。
 */
function packageOfPath(
  packages: WorkspacePackage[],
  root: string,
  relativePath: string,
): undefined | WorkspacePackage {
  const target = toPosixPath(join(toPosixPath(root), toPosixPath(relativePath)));
  let best: undefined | WorkspacePackage;
  for (const pkg of packages) {
    if (target !== pkg.dir && !target.startsWith(`${pkg.dir}/`)) continue;
    if (!best || pkg.dir.length > best.dir.length) best = pkg;
  }
  return best;
}

/** 谁依赖了 target（正向依赖，排除自身），用于评估改动影响面 */
function packagesDependingOn(
  packages: WorkspacePackage[],
  target: string,
): WorkspacePackage[] {
  return packages.filter(
    (pkg) =>
      pkg.name !== target &&
      (target in pkg.dependencies || target in pkg.devDependencies),
  );
}

/** 依赖了 target 的包再往下扩散，得到"改动会波及的全部包名" */
function dependentsClosure(
  packages: WorkspacePackage[],
  targets: string[],
): WorkspacePackage[] {
  const result = new Map<string, WorkspacePackage>();
  const queue = [...targets];
  const seen = new Set(targets);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const pkg of packagesDependingOn(packages, current)) {
      if (seen.has(pkg.name)) continue;
      seen.add(pkg.name);
      result.set(pkg.name, pkg);
      queue.push(pkg.name);
    }
  }
  return [...result.values()];
}

/* ------------------------------ 兼容旧 API ------------------------------ */

/**
 * 查找大仓的根目录（以 pnpm-lock.yaml 为锚点）
 * @param cwd
 */
function findMonorepoRoot(cwd: string = process.cwd()) {
  let currentDir = resolve(cwd);

  while (true) {
    if (existsSync(join(currentDir, 'pnpm-lock.yaml'))) {
      return currentDir;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return '';
    }

    currentDir = parentDir;
  }
}

/**
 * 获取大仓的所有包
 */
function getPackagesSync() {
  const root = findMonorepoRoot();
  return getPackagesSyncFunc(root);
}

/**
 * 获取大仓的所有包
 */
async function getPackages() {
  const root = findMonorepoRoot();

  return await getPackagesFunc(root);
}

/**
 * 获取大仓指定的包
 */
async function getPackage(pkgName: string) {
  const { packages } = await getPackages();
  return packages.find((pkg: manypkg.Package) => pkg.packageJson.name === pkgName);
}

export {
  dependentsClosure,
  findMonorepoRoot,
  getPackage,
  getPackages,
  getPackagesSync,
  listWorkspacePackages,
  listWorkspacePackagesSync,
  packageOfPath,
  packagesDependingOn,
  parseCatalog,
  parseWorkspaceGlobs,
  readWorkspaceConfig,
};
