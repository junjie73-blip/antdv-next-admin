import { beforeEach, describe, expect, it } from 'vitest';

import {
  SCHEDULER_ENABLE_ENV,
  isScheduledPayload,
} from '../server/contracts/tasks';
import {
  getGeneratedSnapshot,
  getRefreshedSnapshot,
  listTaskHistory,
} from '../server/utils/kv/mock-kv';
import { resetCacheFixture } from './fixtures/nitro-cache';
import { resetKvFixture, useKV } from './fixtures/nitro-kv';
import { defineTask, runTask } from './fixtures/nitro-task';

// 三个任务模块在导入时通过 defineTask 注册到测试替身
import '../server/tasks/mock/generate';
import '../server/tasks/mock/refresh';
import '../server/tasks/mock/cleanup';

type TaskOutcome = {
  result: {
    ok: boolean;
    name: string;
    source: string;
    result?: Record<string, unknown>;
    error?: string;
    durationMs: number;
  };
};

describe('Nitro Mock Tasks', () => {
  beforeEach(async () => {
    resetKvFixture();
    resetCacheFixture();
    delete process.env[SCHEDULER_ENABLE_ENV];
    await useKV('mock').clear();
  });

  it('mock:generate 写入 KV 快照并返回生成条数', async () => {
    const outcome = (await runTask('mock:generate', {
      payload: { count: 3 },
    })) as TaskOutcome;

    expect(outcome.result.ok).toBe(true);
    expect(outcome.result.name).toBe('mock:generate');
    expect(outcome.result.source).toBe('manual');
    expect(outcome.result.result?.generated).toBe(3);
    expect((await getGeneratedSnapshot())?.data).toHaveLength(3);
  });

  it('生成条数被夹在 1~100，非法值回落 5', async () => {
    const huge = (await runTask('mock:generate', {
      payload: { count: 999 },
    })) as TaskOutcome;
    expect(huge.result.result?.generated).toBe(100);

    const bad = (await runTask('mock:generate', {
      payload: { count: 'abc' },
    })) as TaskOutcome;
    expect(bad.result.result?.generated).toBe(5);
  });

  it('mock:refresh 写入刷新快照并记录历史', async () => {
    const outcome = (await runTask('mock:refresh')) as TaskOutcome;
    expect(outcome.result.ok).toBe(true);
    expect((await getRefreshedSnapshot())?.data).toHaveProperty('policies');
    expect((await listTaskHistory()).map((h) => h.name)).toContain(
      'mock:refresh',
    );
  });

  it('mock:cleanup 删除过期键并截断历史', async () => {
    const kv = useKV('mock');
    await kv.setItem('ephemeral/old', { v: 1 });
    await kv.setItem('ephemeral/old:meta', { expiresAt: Date.now() - 1000 });
    await kv.setItem('ephemeral/fresh', { v: 2 });
    await kv.setItem('ephemeral/fresh:meta', { expiresAt: Date.now() + 60_000 });

    const outcome = (await runTask('mock:cleanup', {
      payload: { keep: 2 },
    })) as TaskOutcome;

    expect(outcome.result.result?.expiredKeys).toBe(1);
    expect(await kv.getItem('ephemeral/old')).toBeNull();
    expect(await kv.getItem('ephemeral/fresh')).toEqual({ v: 2 });
  });

  it('定时触发默认跳过，设置环境变量后才真正执行', async () => {
    const payload = { scheduledTime: Date.now() };
    expect(isScheduledPayload(payload)).toBe(true);

    const skipped = (await runTask('mock:generate', { payload })) as TaskOutcome;
    expect(skipped.result.result?.skipped).toContain('MOCK_SCHEDULER_ENABLED');

    process.env[SCHEDULER_ENABLE_ENV] = '1';
    try {
      const executed = (await runTask('mock:generate', {
        payload,
      })) as TaskOutcome;
      expect(executed.result.result?.generated).toBe(5);
      expect(executed.result.source).toBe('schedule');
    } finally {
      delete process.env[SCHEDULER_ENABLE_ENV];
    }
  });

  it('executeMockTask 把任务异常收口为 ok=false 并写入历史', async () => {
    const { executeMockTask } = await import('../server/utils/tasks/helpers');
    const outcome = await executeMockTask('mock:cleanup', {}, () => {
      throw new Error('boom');
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toBe('boom');
    expect((await listTaskHistory()).at(-1)?.ok).toBe(false);
  });

  it('defineTask 包装后的任务可被 runTask 调用', async () => {
    defineTask({
      meta: { name: 'mock:echo' },
      run({ payload }) {
        return { result: payload.value };
      },
    });
    const outcome = (await runTask('mock:echo', {
      payload: { value: 'hi' },
    })) as { result: string };
    expect(outcome.result).toBe('hi');
  });

  it('未知任务抛出 404 语义错误', async () => {
    await expect(runTask('mock:missing')).rejects.toThrow('not available');
  });
});
