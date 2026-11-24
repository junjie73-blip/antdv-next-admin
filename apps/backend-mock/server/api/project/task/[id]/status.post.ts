import type { TaskStatus } from '../../../../utils/db/project';

import {
  decorateTask,
  setTaskStatus,
  TASK_STATUS_LABELS,
} from '../../../../utils/db/project';
import { bizError, success } from '../../../../utils/response';
import { defineMockRoute } from '../../../../utils/runtime';

/** 状态流转：待开始 → 进行中 → 已完成；完成自动置 100%，依赖下游自动解锁 */
export default defineMockRoute({
  handler({ data, params }) {
    const status = String(data.status ?? '') as TaskStatus;
    if (!TASK_STATUS_LABELS[status]) return bizError(400, '任务状态不合法');
    const task = setTaskStatus(
      Number(params.id),
      status,
      String(data.note ?? ''),
      String(data.operator ?? '系统'),
    );
    if (!task) return bizError(404, '任务不存在');
    return success(decorateTask(task), '任务状态已更新');
  },
  method: 'POST',
  path: '/project/task/:id/status',
});
