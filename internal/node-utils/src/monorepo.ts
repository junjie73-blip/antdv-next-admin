import { readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { getChangedPackagesSinceRef } from '@changesets/git'
import { getPackages } from '@manypkg/get-packages'
import { readPackageJSON } from 'pkg-types'

import { WORKSPACE_DIRS } from './constants'
import { readJsonFile, readTextFile } from './fs'
import { changedFiles } from './git'
import { relativePosix, toPosixPath } from './path'

export interface PackageJsonLike {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  name?: string
  private?: boolean
  version?: string
  [key: string]: unknown
}

export interface WorkspacePackage {
  /** 绝对路径（POSIX 分隔符） */
  dir: string
  name: string
  private: boolean
  version: string
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}

/**
 * 解析 pnpm-workspace.yaml 的 `catalog:` 段。
 *
 * 不引入 yaml 依赖：catalog 就是「`catalog:` 下一层缩进的 `键: 版本`」，
 * 用正则读足够，且能被单测完整覆盖（带引号的键、注释行、退出到顶层键）。
 */
export function parseCatalog(yamlText: string): Record<string, string> {
  const out: Record<string, string> = {}
  let inside = false

  for (const raw of yamlText.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue

    if (/^catalog(\[[^\]]*\])?:$/.test(line)) {
      inside = true
      continue
    }
    if (!inside) continue
    // 回到顶层键（无前导缩进）说明 catalog 段结束
    if (!raw.startsWith(' ')) {
      inside = false
      continue
    }

    const match = /^\s+"?([^\s":]+)"?:\s*"?([^"\s,]+)"?\s*(?:#.*)?$/.exec(raw)
    if (match?.[1] && match[2]) out[match[1]] = match[2]
  }

  return out
}

/** 解析 `packages:` 段，返回 workspace glob（用于校验目录约定） */
export function parseWorkspaceGlobs(yamlText: string): string[] {
  const out: string[] = []
  let inside = false

  for (const raw of yamlText.split(/\r?\n/)) {
    const line = raw.trim()
    if (/^packages:$/.test(line)) {
      inside = true
      continue
    }
    if (!inside) continue
    if (!raw.startsWith(' ') && line) {
      inside = false
      continue
    }

    const match = /^\s*-\s*['"]?([^'"\s#]+)['"]?\s*$/.exec(raw)
    if (match?.[1]) out.push(match[1])
  }

  return out
}

export async function readWorkspaceConfig(root: string): Promise<{
  catalog: Record<string, string>
  globs: string[]
}> {
  const text = await readTextFile(
    join(root, 'pnpm-workspace.yaml'),
    await readTextFile(join(root, 'pnpm-workspace.yml')),
  )
  return { catalog: parseCatalog(text), globs: parseWorkspaceGlobs(text) }
}

function toPackage(dir: string, json: PackageJsonLike): WorkspacePackage {
  return {
    dependencies: json.dependencies ?? {},
    devDependencies: json.devDependencies ?? {},
    dir: toPosixPath(resolve(dir)),
    name: json.name ?? '',
    private: json.private ?? false,
    version: json.version ?? '0.0.0',
  }
}

/** 约定式扫描：`apps|internal|packages/<name>/package.json` */
async function scanByConvention(root: string): Promise<WorkspacePackage[]> {
  const out: WorkspacePackage[] = []
  for (const group of WORKSPACE_DIRS) {
    const names = await readdir(join(root, group)).catch(() => [] as string[])
    for (const name of names) {
      const dir = join(root, group, name)
      const json = await readJsonFile<PackageJsonLike>(
        join(dir, 'package.json'),
      )
      if (json?.name) out.push(toPackage(dir, json))
    }
  }
  return out
}

/**
 * 列出 workspace 内的所有子包。
 *
 * 主路径用 `@manypkg/get-packages`：它认识 pnpm-workspace.yaml 的 glob 与
 * `!apps/legacy` 排除语法，比我们自己拼路径准。它抛错时（配置不合法 /
 * 非 pnpm 仓库）回退到目录约定扫描，保证脚本不会因为一个依赖不可用而整体失败。
 */
export async function listWorkspacePackages(
  root: string = process.cwd(),
): Promise<WorkspacePackage[]> {
  const base = resolve(root)
  let packages: WorkspacePackage[] = []

  try {
    const { packages: found } = await getPackages(base)
    packages = found
      .map((pkg) =>
        toPackage(
          (pkg as { packageDir?: string; dir?: string }).packageDir ??
            pkg.dir ??
            base,
          pkg.packageJson as PackageJsonLike,
        ),
      )
      .filter((pkg) => pkg.name)
  } catch {
    packages = await scanByConvention(base)
  }

  return packages.sort((a, b) => a.name.localeCompare(b.name))
}

export async function findPackageByName(
  name: string,
  root: string = process.cwd(),
): Promise<WorkspacePackage | undefined> {
  const packages = await listWorkspacePackages(root)
  return packages.find((pkg) => pkg.name === name)
}

/**
 * 读任意位置的 package.json：pkg-types 会自己向上找最近的 manifest，
 * 因此传子目录（如 `apps/web/src`）也能拿到所属包信息。
 */
export async function readPackageJson(
  from: string,
): Promise<PackageJsonLike | undefined> {
  return (await readPackageJSON(from).catch(() => undefined)) as
    | PackageJsonLike
    | undefined
}

/**
 * POSIX 相对路径 -> 所属子包。
 *
 * 取「最长目录前缀」匹配：`apps/web/src/x.ts` 同时落在 `apps` 与 `apps/web` 下，
 * 只有最深的那个才是真正的所有者。
 */
export function packageOfPath(
  packages: WorkspacePackage[],
  root: string,
  posixPath: string,
): WorkspacePackage | undefined {
  const normalized = toPosixPath(posixPath)
  const matches = packages.filter((pkg) => {
    const rel = relativePosix(root, pkg.dir)
    return rel && rel !== '.' ? normalized.startsWith(`${rel}/`) : false
  })
  if (!matches.length) return undefined
  return matches.reduce((a, b) =>
    a.dir.length >= b.dir.length ? a : b,
  )
}

/** 反向依赖：改了某个包，哪些下游需要连带构建 */
export function packagesDependingOn(
  packages: WorkspacePackage[],
  depName: string,
): WorkspacePackage[] {
  return packages.filter(
    (pkg) =>
      pkg.name !== depName &&
      (depName in pkg.dependencies || depName in pkg.devDependencies),
  )
}

/** 变更涉及的子包（默认含工作区未提交变更），供 changesets / CI 增量使用 */
export async function changedPackages(
  root: string = process.cwd(),
  ref?: string,
): Promise<WorkspacePackage[]> {
  const base = resolve(root)
  const packages = await listWorkspacePackages(base)
  const files = await changedFiles(base, ref)

  const names = new Set<string>()
  for (const file of files) {
    const pkg = packageOfPath(packages, base, file)
    if (pkg) names.add(pkg.name)
  }

  return packages.filter((pkg) => names.has(pkg.name))
}

/**
 * 相对某个 ref 变更了哪些包（返回包名）。
 *
 * 优先用 changesets 的实现：它按 merge-base 比较并内置了「忽略 lockfile / changeset 文件」
 * 的规则，和发布流程的判断口径一致；接口不兼容或非 git 仓库时退回本地 diff 实现。
 */
export async function changedPackageNamesSinceRef(
  ref: string,
  root: string = process.cwd(),
): Promise<string[]> {
  const base = resolve(root)

  try {
    const changed = await getChangedPackagesSinceRef({ cwd: base, ref })
    return changed
      .map((pkg) => (pkg.packageJson as PackageJsonLike).name ?? '')
      .filter(Boolean)
      .sort()
  } catch {
    const packages = await changedPackages(base, ref)
    return packages.map((pkg) => pkg.name).sort()
  }
}
