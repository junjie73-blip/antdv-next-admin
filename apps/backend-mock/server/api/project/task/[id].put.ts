import {
  decorateTask,
  pickTaskFields,
  PROJECT_TASK_DB,
  refreshProject,
} from '../../../utils/db/project';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 编辑任务：负责人、排期、优先级、依赖都可改；进度不在这里写，必须走进度接口 */
export default defineMockRoute({
  handler({ data, params }) {
    const index = PROJECT_TASK_DB.findIndex(
      (task) => task.id === Number(params.id),
    );
    const current = PROJECT_TASK_DB[index];
    if (!current) return bizError(404, '任务不存在');
    const patch = pickTaskFields(data as Record<string, unknown>);
    const next = { ...current, ...patch };
    if (dayjsInvalid(next.startDate) || dayjsInvalid(next.dueDate))
      return bizError(400, '日期格式不正确');
    if (next.dueDate < next.startDate)
      return bizError(400, '截止日期不能早于开始日期');

    PROJECT_TASK_DB[index] = next;
    refreshProject(current.projectId);
    return success(decorateTask(PROJECT_TASK_DB[index]!), '任务更新成功');
  },
  method: 'PUT',
  path: '/project/task/:id',
});

function dayjsInvalid(value: string): boolean {
  return !/^\d{4}-\d{2}-\d{2}$/u.test(value);
}
