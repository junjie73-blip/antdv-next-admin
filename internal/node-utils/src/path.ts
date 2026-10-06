import { isAbsolute, join, relative, resolve, sep } from 'node:path'

import { findUp, findUpSync } from 'find-up'

/**
 * Windows 是仓库的主要开发环境，而 Node 的 `path.sep` 在这里是 `\`。
 * 只要路径会进 glob、URL、产物清单或 Git 输出，就必须先转成 POSIX 形式，
 * 否则同一份代码在 CI（Linux）和本地（Windows）产出的 key 不一致。
 */
export function toPosixPath(path: string): string {
  return path.replaceAll('\\', '/')
}

export function fromPosixPath(path: string): string {
  return sep === '/' ? path : path.replaceAll('/', sep)
}

export function isAbsolutePath(path: string): boolean {
  return isAbsolute(path) || /^[a-zA-Z]:[\\/]/.test(path)
}

/** 相对 root 的 POSIX 路径；root 之外的路径原样返回绝对路径 */
export function relativePosix(root: string, target: string): string {
  const rel = relative(resolve(root), resolve(target))
  return rel.startsWith('..') ? toPosixPath(target) : toPosixPath(rel) || '.'
}

export function joinPosix(...segments: string[]): string {
  return toPosixPath(join(...segments))
}

/** 去掉后缀的文件名：`a/b/index.ts` -> `a/b/index` */
export function stripExtension(path: string): string {
  const index = path.lastIndexOf('.')
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return index > slash ? path.slice(0, index) : path
}

export function extname(path: string): string {
  const normalized = toPosixPath(path)
  const base = normalized.slice(normalized.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot) : ''
}

/** 向上找最近的包根目录（含 package.json 的目录），monorepo 里定位当前包很常用 */
export async function findPackageRoot(cwd: string = process.cwd()): Promise<string | undefined> {
  const manifest = await findUp('package.json', { cwd })
  return manifest ? resolve(manifest, '..') : undefined
}

/** 仓库根锚点：优先 workspace 清单，其次 .git 目录 */
const REPO_ANCHORS = ['pnpm-workspace.yaml', 'pnpm-workspace.yml']

/** 向上找仓库根：以 pnpm-workspace.yaml 为锚点，比 .git 更可靠（子模块 / CI checkout 场景） */
export async function findRepoRoot(cwd: string = process.cwd()): Promise<string | undefined> {
  const workspace = await findUp(REPO_ANCHORS, { cwd })
  if (workspace) return resolve(workspace, '..')
  const gitDir = await findUp('.git', { cwd, type: 'directory' })
  return gitDir ? resolve(gitDir, '..') : undefined
}

/**
 * findRepoRoot 的同步版本。
 * 构建配置（vite.config / tsdown.config / turbo 脚本）在顶层执行时不能 await，
 * 只能同步定位仓库根。
 */
export function findRepoRootSync(cwd: string = process.cwd()): string | undefined {
  const workspace = findUpSync(REPO_ANCHORS, { cwd })
  if (workspace) return resolve(workspace, '..')
  const gitDir = findUpSync('.git', { cwd, type: 'directory' })
  return gitDir ? resolve(gitDir, '..') : undefined
}

/** 相对仓库根的 POSIX 路径；省略 repoRoot 时自动同步定位，脚本里最常用 */
export function repoRelative(cwd: string = process.cwd(), repoRoot?: string): string {
  const root = repoRoot ?? findRepoRootSync(cwd)
  // 不在仓库里（例如临时目录里跑脚本）时退化成绝对路径，而不是抛异常
  if (root === undefined) return toPosixPath(resolve(cwd))
  return relativePosix(root, cwd)
}

export function resolveFromRoot(repoRoot: string, ...segments: string[]): string {
  return resolve(repoRoot, ...segments)
}
