import { execa } from 'execa'

export interface GitResult {
  ok: boolean
  stdout: string
}

/**
 * 所有 git 操作都限定在 `cwd`，因为脚本可能在仓库任意子目录被调用
 * （turbo 会把任务 cwd 切到各个 package），不加 cwd 会读到错误的分支/暂存区。
 */
export async function gitRun(
  args: string[],
  cwd: string = process.cwd(),
): Promise<GitResult> {
  try {
    const result = await execa('git', args, { cwd, all: false })
    return { ok: !result.failed, stdout: result.stdout.trim() }
  } catch (error) {
    const stdout =
      typeof error === 'object' && error && 'stdout' in error
        ? String((error as { stdout?: unknown }).stdout ?? '').trim()
        : ''
    return { ok: false, stdout }
  }
}

function lines(stdout: string): string[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export async function isGitRepo(cwd: string = process.cwd()): Promise<boolean> {
  const { ok, stdout } = await gitRun(['rev-parse', '--is-inside-work-tree'], cwd)
  return ok && stdout === 'true'
}

export async function currentBranch(cwd: string = process.cwd()): Promise<string> {
  const { stdout } = await gitRun(['rev-parse', '--abbrev-ref', 'HEAD'], cwd)
  return stdout
}

export async function headCommit(
  cwd: string = process.cwd(),
  options: { short?: boolean } = {},
): Promise<string> {
  const args = options.short
    ? ['rev-parse', '--short', 'HEAD']
    : ['rev-parse', 'HEAD']
  const { stdout } = await gitRun(args, cwd)
  return stdout
}

/** 工作区是否干净（含未跟踪文件），CI 与「同步上游」脚本用它决定要不要提交 */
export async function isDirty(cwd: string = process.cwd()): Promise<boolean> {
  const { ok, stdout } = await gitRun(['status', '--porcelain', '--untracked-files=all'], cwd)
  return ok && stdout.length > 0
}

/** 相对某个 ref 的变更文件列表；不传 ref 时返回工作区未提交的变更 */
export async function changedFiles(
  cwd: string = process.cwd(),
  ref?: string,
): Promise<string[]> {
  const args = ref
    ? ['diff', '--name-only', `${ref}...HEAD`]
    : ['diff', '--name-only', 'HEAD']
  const { ok, stdout } = await gitRun(args, cwd)
  if (!ok) return []
  const result = new Set(lines(stdout))

  // 未跟踪文件不在 diff 里，但同步工具需要它们
  if (!ref) {
    const untracked = await gitRun(['ls-files', '--others', '--exclude-standard'], cwd)
    for (const file of lines(untracked.stdout)) result.add(file)
  }

  return [...result].sort()
}

export async function latestTag(cwd: string = process.cwd()): Promise<string> {
  const { stdout } = await gitRun(['describe', '--tags', '--abbrev=0'], cwd)
  return stdout
}

export async function commitCount(
  cwd: string = process.cwd(),
  since?: string,
): Promise<number> {
  const args = ['rev-list', '--count', 'HEAD']
  const { stdout } = await gitRun(since ? [...args, `--since=${since}`] : args, cwd)
  const count = Number.parseInt(stdout, 10)
  return Number.isFinite(count) ? count : 0
}

/** 单条提交的摘要，用于 CHANGELOG / 同步说明 */
export interface CommitInfo {
  hash: string
  subject: string
}

export async function recentCommits(
  cwd: string = process.cwd(),
  limit = 10,
): Promise<CommitInfo[]> {
  const separator = '\u001f'
  const recordEnd = '\u001e'
  const { ok, stdout } = await gitRun(
    ['log', `-n${limit}`, `--pretty=%h${separator}%s${recordEnd}`],
    cwd,
  )
  if (!ok) return []

  return stdout
    .split(recordEnd)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [hash = '', subject = ''] = chunk.split(separator)
      return { hash, subject }
    })
}

export { lines as splitLines }
