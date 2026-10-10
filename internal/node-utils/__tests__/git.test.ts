import { describe, expect, it } from 'vitest';

import {
  changedFiles,
  commitCount,
  currentBranch,
  gitRun,
  headCommit,
  isDirty,
  isGitRepo,
  isTransientSpawnError,
  recentCommits,
} from '../src/git';
import { findRepoRoot } from '../src/path';

describe('gitRun', () => {
  it('未知子命令返回 ok=false 且不抛异常', async () => {
    const { ok } = await gitRun(['not-a-real-command'], process.cwd());
    expect(ok).toBe(false);
  });
});

/**
 * 重试判据：把"子进程没起来"和"git 说了不"分开。
 *
 * 前者是并发跑单测时的真实故障（turbo 一次拉起十几个 vitest，每个都在 spawn git），
 * 重试就能过去；后者是确定性答案，重试只是把同一句错误抄一遍。
 * 混在一起的代价是一条 flaky 红会把真缺陷一起淹掉。
 */
describe('isTransientSpawnError', () => {
  it('系统级资源错误可以重试', () => {
    for (const code of ['EAGAIN', 'EMFILE', 'ENFILE', 'ENOBUFS', 'ERR_PROC_CREATE'])
      expect(isTransientSpawnError({ code })).toBe(true);
  });

  it('已经有 exitCode 就是 git 给的答案，不重试', () => {
    expect(isTransientSpawnError({ code: 'EAGAIN', exitCode: 128 })).toBe(false);
    expect(isTransientSpawnError({ exitCode: 1 })).toBe(false);
    // 退出码 0 但抛了错（异常本身不是"没起来"）也不重试
    expect(isTransientSpawnError({ exitCode: 0 })).toBe(false);
  });

  it('认不出的错误一律不重试，避免把真故障洗成慢', () => {
    expect(isTransientSpawnError({ code: 'ENOENT' })).toBe(false);
    expect(isTransientSpawnError({})).toBe(false);
    expect(isTransientSpawnError(undefined)).toBe(false);
  });
});

describe('仓库内查询', () => {
  it('能定位仓库并读出分支 / commit / 提交数', async () => {
    const root = (await findRepoRoot()) as string;
    expect(await isGitRepo(root)).toBe(true);
    expect(typeof (await currentBranch(root))).toBe('string');
    expect(await currentBranch(root)).toBeTruthy();

    const full = await headCommit(root);
    expect(full).toMatch(/^[0-9a-f]{40}$/);
    expect((await headCommit(root, { short: true })).length).toBeLessThan(
      full.length,
    );

    expect(await commitCount(root)).toBeGreaterThan(0);
  });

  it('recentCommits 解析 %x1f 分隔的日志行', async () => {
    const root = (await findRepoRoot()) as string;
    const commits = await recentCommits(root, 3);
    expect(commits.length).toBeGreaterThan(0);
    expect(commits[0]?.hash).toBeTruthy();
    expect(typeof commits[0]?.subject).toBe('string');
  });

  it('changedFiles 返回排序后的相对路径数组', async () => {
    const root = (await findRepoRoot()) as string;
    const files = await changedFiles(root);
    expect(Array.isArray(files)).toBe(true);
    expect(files).toEqual([...files].sort());
  });

  it('isDirty 只回答布尔值', async () => {
    const root = (await findRepoRoot()) as string;
    expect(typeof (await isDirty(root))).toBe('boolean');
  });
});
