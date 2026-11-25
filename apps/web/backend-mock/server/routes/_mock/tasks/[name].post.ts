/**
 * POST /_mock/tasks/:name — 手动执行 Nitro 任务
 * body: { "payload": { ... } }（payload 直接作为任务入参）
 */
import { defineHandler } from 'nitro';
import { getRouterParams, readBody } from 'nitro/h3';
import { runTask } from 'nitro/task';

import { ApiCode } from '../../../contracts/codes';
import {
  MOCK_TASK_NAMES,
  type MockTaskName,
} from '../../../contracts/tasks';
import { bizError, success } from '../../../utils/response';

export default defineHandler(async (event) => {
  const { name } = getRouterParams(event) as { name?: string };
  if (!name || !MOCK_TASK_NAMES.includes(name as MockTaskName)) {
    return bizError(ApiCode.NOT_FOUND, `未知的 Mock 任务：${name ?? ''}`);
  }
  const body = (await readBody(event)) as { payload?: Record<string, unknown> } | null;
  const payload = body?.payload ?? {};
  if (typeof payload !== 'object' || Array.isArray(payload)) {
    return bizError(ApiCode.BAD_REQUEST, 'payload 必须是对象');
  }

  const outcome = (await runTask(name, { payload })) as {
    result?: unknown;
  };
  return success(outcome?.result ?? outcome ?? null);
});
