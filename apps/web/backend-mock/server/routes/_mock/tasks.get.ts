/**
 * GET /_mock/tasks — 列出可用任务与定时配置
 */
import { defineHandler } from 'nitro';

import { MOCK_TASKS, SCHEDULER_ENABLE_ENV } from '../../contracts/tasks';
import { success } from '../../utils/response';

export default defineHandler(() => {
  return success({
    list: MOCK_TASKS,
    total: MOCK_TASKS.length,
    schedulerEnabled: process.env[SCHEDULER_ENABLE_ENV] === '1',
    schedulerEnv: SCHEDULER_ENABLE_ENV,
  });
});
