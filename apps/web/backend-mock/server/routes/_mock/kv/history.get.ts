/**
 * GET /_mock/kv/history — 查看任务执行历史（KV 持久化，最多保留 100 条）
 */
import { defineHandler } from 'nitro';

import { success } from '../../../utils/response';
import { listTaskHistory } from '../../../utils/kv/mock-kv';

export default defineHandler(async () => {
  const list = await listTaskHistory();
  return success({ list, total: list.length });
});
