import dayjs from 'dayjs';

import {
  decorateTask,
  nextTaskId,
  PROJECT_PHASE_DB,
  PROJECT_TASK_DB,
  refreshProject,
} from '../../../utils/db/project';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 新建任务：必须指定项目与阶段，未给日期时按阶段排期落位 */
export default defineMockRoute({
  handler({ data }) {
    const title = String(data.title ?? '').trim();
    if (!title) return bizError(400, '任务标题不能为空');
    const projectId = Number(data.projectId);
    if (!projectId) return bizError(400, '请选择所属项目');
    const phase = PROJECT_PHASE_DB.find(
      (item) =>
        item.id === Number(data.phaseId) && item.projectId === projectId,
    );
    if (!phase) return bizError(400, '请选择该项目下的阶段');

    const task = {
      dependsOn: String(data.dependsOn ?? ''),
      dueDate: String(data.dueDate || phase.endDate),
      id: nextTaskId(),
      owner: String(data.owner ?? ''),
      phaseId: phase.id,
      priority: (data.priority || 'middle') as never,
      progress: 0,
      projectId,
      remark: String(data.remark ?? ''),
      startDate: String(data.startDate || phase.startDate),
      status: 'pending' as const,
      title,
      updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    };
    if (dayjs(task.dueDate).isBefore(dayjs(task.startDate), 'day'))
      return bizError(400, '截止日期不能早于开始日期');

    PROJECT_TASK_DB.push(task);
    refreshProject(projectId);
    return success(
      decorateTask(PROJECT_TASK_DB.find((item) => item.id === task.id)!),
      '任务创建成功',
    );
  },
  method: 'POST',
  path: '/project/task',
});
