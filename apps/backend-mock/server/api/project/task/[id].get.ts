import {
  decorateTask,
  PROJECT_LOG_DB,
  PROJECT_TASK_DB,
} from '../../../utils/db/project';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 任务详情带自己的进度流水，抽屉里可以直接看到「完成到哪一步」 */
export default defineMockRoute({
  handler({ params }) {
    const id = Number(params.id);
    const task = PROJECT_TASK_DB.find((item) => item.id === id);
    if (!task) return bizError(404, '任务不存在');
    const logs = PROJECT_LOG_DB.filter((item) => item.taskId === id).sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt),
    );
    return success({ logs, task: decorateTask(task) }, '获取任务详情成功');
  },
  method: 'GET',
  path: '/project/task/:id',
});
