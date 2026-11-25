/**
 * Mock 任务公共逻辑
 *
 * 统一处理：调度开关、耗时统计、结果包装、KV 历史落盘与错误收口。
 * 任务实现只负责自己的业务，不重复写这些样板代码。
 */

import {
  isScheduledPayload,
  SCHEDULER_ENABLE_ENV,
  type MockTaskName,
  type MockTaskResult,
} from '../../contracts/tasks';
import { appendTaskHistory } from '../kv/mock-kv';

/**
 * 定时触发默认跳过：快照生成 / 单元测试期间不希望后台任务改 KV 造成非确定性。
 * 手动通过 HTTP 端点触发的任务不受影响；生产设置 MOCK_SCHEDULER_ENABLED=1 开启。
 */
export function schedulerAllowed(payload: unknown): boolean {
  if (!isScheduledPayload(payload)) return true;
  return process.env[SCHEDULER_ENABLE_ENV] === '1';
}

/** 包一层统一结果，并保证历史写入不反过来打断任务 */
export async function executeMockTask<T>(
  name: MockTaskName,
  payload: Record<string, unknown>,
  run: () => Promise<T> | T,
): Promise<MockTaskResult> {
  const startedAt = Date.now();
  const source = isScheduledPayload(payload) ? 'schedule' : 'manual';

  if (!schedulerAllowed(payload)) {
    const result: MockTaskResult = {
      ok: true,
      name,
      at: new Date(startedAt).toISOString(),
      durationMs: 0,
      source,
      result: { skipped: `定时调度未启用（设置 ${SCHEDULER_ENABLE_ENV}=1 开启）` },
    };
    await appendTaskHistory({
      at: result.at,
      durationMs: 0,
      name,
      ok: true,
      result: result.result,
      source,
    });
    return result;
  }

  const result: MockTaskResult = {
    ok: true,
    name,
    at: new Date(startedAt).toISOString(),
    durationMs: 0,
    source,
  };
  try {
    result.result = await run();
    return result;
  } catch (error) {
    result.ok = false;
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  } finally {
    result.durationMs = Date.now() - startedAt;
    await appendTaskHistory({
      at: result.at,
      durationMs: result.durationMs,
      name,
      ok: result.ok,
      ...(result.result !== undefined ? { result: result.result } : {}),
      ...(result.error ? { error: result.error } : {}),
      source,
    });
  }
}
