import path from 'node:path';

import { add as changesetsAdd } from '@changesets/git';
import { execa } from 'execa';

import { toPosixPath } from './path';

export * from '@changesets/git';

/**
 * `git add <file>` 的语义化别名。
 * 之所以写成函数而不是 `export { add as gitAdd }`：tsdown 生成 dts 时
 * 会把星号重导出的成员展开成 `git_d_exports.add as gitAdd`，那是非法语法。
 */
async function gitAdd(pathToFile: string, cwd: string): Promise<boolean> {
  return changesetsAdd(pathToFile, cwd);
}

export interface GitResult {
  /** 退出码 0 为 true；git 的报错写进 stderr，不该让脚本整体崩掉 */
  ok: boolean;
  stderr: string;
  stdout: string;
}

/**
 * `gitRun` 的重试判据。
 *
 * 只在"子进程没起来"时重试：并发跑整套单测（turbo 同时拉起十几个 vitest 进程）时，
 * Windows/POSIX 都可能给出 `EAGAIN` / `EMFILE` / `ERR_PROC_CREATE` 这类系统级资源错误，
 * 这类失败重试一次基本就过去了。
 * 反过来，**有 `exitCode` 就说明进程起来并且给出了答案**（非 0 = git 说了"不"，
 * 比如不在仓库里、子命令不存在），那是确定性结果，重试只会把同一句错误再抄一遍。
 */
const TRANSIENT_SPAWN_CODES = new Set([
  'EAGAIN',
  'EMFILE',
  'ENFILE',
  'ENOBUFS',
  'ERR_PROC_CREATE',
]);

function isTransientSpawnError(error: unknown): boolean {
  // `error` 可能是 undefined / 字符串（非 Error 抛出），直接解构会自己抛一次
  if (!error || typeof error !== 'object') return false;
  const { code, exitCode } = error as { code?: string; exitCode?: number };
  if (exitCode !== undefined && exitCode !== null) return false;
  return !!code && TRANSIENT_SPAWN_CODES.has(code);
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 所有只读 git 调用的唯一入口：统一 cwd、统一失败口径 */
async function gitRun(args: string[], cwd: string): Promise<GitResult> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { stderr, stdout } = await execa('git', args, { cwd });
      return { ok: true, stderr, stdout };
    } catch (error) {
      const { message = '', stderr = '' } = error as {
        code?: string;
        exitCode?: number;
        message?: string;
        stderr?: string;
      };
      if (!isTransientSpawnError(error) || attempt === 1)
        return { ok: false, stderr: stderr || message, stdout: '' };
      // 让出事件循环，等系统资源回收再起一次
      await delay(50 * (attempt + 1));
    }
  }
  /* 兜底：循环里的 return 覆盖了全部路径，这里只为类型完整 */
  return { ok: false, stderr: 'git 调用未返回', stdout: '' };
}

async function isGitRepo(cwd: string): Promise<boolean> {
  const { ok, stdout } = await gitRun(
    ['rev-parse', '--is-inside-work-tree'],
    cwd,
  );
  return ok && stdout.trim() === 'true';
}

/** 分离 HEAD 时 git 返回 'HEAD'，原样透出交给调用方判断 */
async function currentBranch(cwd: string): Promise<string> {
  const { ok, stdout } = await gitRun(
    ['rev-parse', '--abbrev-ref', 'HEAD'],
    cwd,
  );
  return ok ? stdout.trim() : '';
}

async function headCommit(
  cwd: string,
  options: { short?: boolean } = {},
): Promise<string> {
  const args = options.short
    ? ['rev-parse', '--short', 'HEAD']
    : ['rev-parse', 'HEAD'];
  const { ok, stdout } = await gitRun(args, cwd);
  return ok ? stdout.trim() : '';
}

async function commitCount(cwd: string): Promise<number> {
  const { ok, stdout } = await gitRun(['rev-list', '--count', 'HEAD'], cwd);
  const count = Number.parseInt(stdout.trim(), 10);
  return ok && Number.isFinite(count) ? count : 0;
}

export interface CommitInfo {
  date: string;
  hash: string;
  subject: string;
}

/**
 * %x1f 作为字段分隔符：commit subject 里出现空格、引号、竖线都很常见，
 * 用可读字符分隔必然要在解析端写一堆特例。
 */
async function recentCommits(cwd: string, count = 10): Promise<CommitInfo[]> {
  const { ok, stdout } = await gitRun(
    ['log', `-n${count}`, '--date=iso-strict', '--format=%H%x1f%ad%x1f%s'],
    cwd,
  );
  if (!ok) return [];
  return stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash = '', date = '', subject = ''] = line.split('\u001F');
      return { date, hash, subject };
    });
}

/**
 * 工作区改动（含未跟踪），返回排序后的仓库相对路径。
 * -z 让路径不进引号、也不受 core.quotepath 影响，中文文件名不会变八进制转义。
 */
async function changedFiles(cwd: string): Promise<string[]> {
  const { ok, stdout } = await gitRun(
    ['status', '--porcelain', '-z', '--untracked-files=all'],
    cwd,
  );
  if (!ok) return [];
  const files = stdout
    .split('\0')
    .filter(Boolean)
    .map((entry) => entry.slice(3))
    .filter(Boolean);
  return [...new Set(files.map(toPosixPath))].sort();
}

async function isDirty(cwd: string): Promise<boolean> {
  return (await changedFiles(cwd)).length > 0;
}

/**
 * 获取暂存区文件
 */
async function getStagedFiles(): Promise<string[]> {
  try {
    const { stdout } = await execa('git', [
      '-c',
      'submodule.recurse=false',
      'diff',
      '--staged',
      '--diff-filter=ACMR',
      '--name-only',
      '--ignore-submodules',
      '-z',
    ]);

    const nullSeparator = '\u0000';
    const normalizedStdout = stdout.endsWith(nullSeparator)
      ? stdout.slice(0, -1)
      : stdout;
    let changedList = normalizedStdout
      ? normalizedStdout.split(nullSeparator)
      : [];
    changedList = changedList.map((item) => path.resolve(process.cwd(), item));
    const changedSet = new Set(changedList);
    changedSet.delete('');
    return [...changedSet];
  } catch (error) {
    console.error('Failed to get staged files:', error);
    return [];
  }
}

export {
  changedFiles,
  commitCount,
  currentBranch,
  getStagedFiles,
  gitAdd,
  gitRun,
  headCommit,
  isDirty,
  isGitRepo,
  isTransientSpawnError,
  recentCommits,
};
