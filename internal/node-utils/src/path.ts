import { posix, resolve, sep } from 'node:path';

import { findUp, findUpSync } from 'find-up';

/**
 * 仓库根的锚点文件：pnpm-workspace.yaml 比 pnpm-lock.yaml 更可靠，
 * lockfile 在新克隆里可能还没生成，而 workspace 声明一定在。
 */
const REPO_ANCHORS = ['pnpm-workspace.yaml', 'pnpm-workspace.yml'];

/**
 * 将给定的文件路径转换为 POSIX 风格。
 * rolldown / vite / glob 的匹配都按正斜杠口径，Windows 反斜杠进来会静默失配。
 * @param {string} pathname - 原始文件路径。
 */
function toPosixPath(pathname: string) {
  return pathname.split(`\\`).join(posix.sep);
}

/** toPosixPath 的逆操作，交给运行平台的分隔符 */
function fromPosixPath(pathname: string) {
  return pathname.split(posix.sep).join(sep);
}

/**
 * Node 的 path.isAbsolute 绑定平台，跨平台工具里不能直接用：
 * 在 Linux CI 上判断 Windows 路径会得出 false。这里同时认盘符与 UNC。
 */
function isAbsolutePath(pathname: string): boolean {
  if (!pathname) return false;
  if (pathname.startsWith('/')) return true;
  return /^[a-zA-Z]:[\\/]/.test(pathname);
}

/** 拼接并归一成正斜杠，用于生成相对路径 / glob 模式 */
function joinPosix(...parts: string[]): string {
  return posix.join(...parts);
}

/**
 * 归一化：绝对路径只做分隔符转换，相对路径才 resolve 到 cwd。
 * 对 '/repo/apps' 调 resolve 在 Windows 上会补出当前盘符（J:/repo/apps），
 * 跨平台的路径比较必须先排除这种隐式补全。
 */
function normalizePosix(pathname: string): string {
  const posixPath = toPosixPath(pathname);
  return isAbsolutePath(posixPath) ? posixPath : toPosixPath(resolve(posixPath));
}

/**
 * 相对仓库根的输出统一成 POSIX 形式；跑出根之外时保留绝对路径，
 * 而不是产出 '../..' 开头的路径——调用方拿到相对路径是要写进配置或展示的。
 */
function relativePosix(from: string, to: string): string {
  const base = normalizePosix(from);
  const target = normalizePosix(to);
  const relativePath = posix.relative(base, target);
  if (!relativePath) return '.';
  if (relativePath.startsWith('..') || posix.isAbsolute(relativePath)) {
    return target;
  }
  return relativePath;
}

/** 去掉最后一段后缀；无后缀时原样返回 */
function stripExtension(pathname: string): string {
  const normalized = toPosixPath(pathname);
  const index = normalized.lastIndexOf('.');
  const baseName = normalized.slice(normalized.lastIndexOf('/') + 1);
  // '.npmrc' 这类隐藏文件没有后缀可言，整名就是文件名
  if (index <= 0 || !baseName.includes('.')) return normalized;
  return normalized.slice(0, index);
}

function extname(pathname: string): string {
  return posix.extname(toPosixPath(pathname));
}

/** 从 cwd 向上找仓库根（异步），找不到返回 undefined */
async function findRepoRoot(
  cwd: string = process.cwd(),
): Promise<string | undefined> {
  const anchor = await findUp(REPO_ANCHORS, { cwd: resolve(cwd), type: 'file' });
  return anchor === undefined ? undefined : posix.dirname(toPosixPath(anchor));
}

/** 同步版：构建期的 vite.config / tsdown 配置里只能用它 */
function findRepoRootSync(cwd: string = process.cwd()): string | undefined {
  const anchor = findUpSync(REPO_ANCHORS, {
    cwd: resolve(cwd),
    type: 'file',
  });
  return anchor === undefined ? undefined : posix.dirname(toPosixPath(anchor));
}

/**
 * cwd 相对仓库根的路径，用于日志与 turbo filter（`--filter=./apps/web`）。
 * repoRoot 省略时自动向上定位；不在仓库内时退回绝对路径，绝不抛异常。
 */
function repoRelative(cwd: string = process.cwd(), repoRoot?: string): string {
  const root = repoRoot ?? findRepoRootSync(cwd);
  if (root === undefined) return toPosixPath(resolve(cwd));
  return relativePosix(root, cwd);
}

export {
  extname,
  findRepoRoot,
  findRepoRootSync,
  fromPosixPath,
  isAbsolutePath,
  joinPosix,
  relativePosix,
  repoRelative,
  stripExtension,
  toPosixPath,
};
