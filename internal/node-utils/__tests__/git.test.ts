import { describe, expect, it } from 'vitest'

import {
  changedFiles,
  commitCount,
  currentBranch,
  gitRun,
  headCommit,
  isDirty,
  isGitRepo,
  recentCommits,
} from '../src/git'
import { findRepoRoot } from '../src/path'

describe('gitRun', () => {
  it('未知子命令返回 ok=false 且不抛异常', async () => {
    const { ok } = await gitRun(['not-a-real-command'], process.cwd())
    expect(ok).toBe(false)
  })
})

describe('仓库内查询', () => {
  it('能定位仓库并读出分支 / commit / 提交数', async () => {
    const root = (await findRepoRoot()) as string
    expect(await isGitRepo(root)).toBe(true)
    expect(typeof await currentBranch(root)).toBe('string')
    expect(await currentBranch(root)).toBeTruthy()

    const full = await headCommit(root)
    expect(full).toMatch(/^[0-9a-f]{40}$/)
    expect((await headCommit(root, { short: true })).length).toBeLessThan(full.length)

    expect(await commitCount(root)).toBeGreaterThan(0)
  })

  it('recentCommits 解析 %x1f 分隔的日志行', async () => {
    const root = (await findRepoRoot()) as string
    const commits = await recentCommits(root, 3)
    expect(commits.length).toBeGreaterThan(0)
    expect(commits[0]?.hash).toBeTruthy()
    expect(typeof commits[0]?.subject).toBe('string')
  })

  it('changedFiles 返回排序后的相对路径数组', async () => {
    const root = (await findRepoRoot()) as string
    const files = await changedFiles(root)
    expect(Array.isArray(files)).toBe(true)
    expect(files).toEqual([...files].sort())
  })

  it('isDirty 只回答布尔值', async () => {
    const root = (await findRepoRoot()) as string
    expect(typeof await isDirty(root)).toBe('boolean')
  })
})
