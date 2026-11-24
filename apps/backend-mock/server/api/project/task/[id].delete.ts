import {
  PROJECT_LOG_DB,
  PROJECT_TASK_DB,
  refreshProject,
} from '../../../utils/db/project';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 删除任务：同时清理流水并重算项目进度，避免"任务删了进度没变" */
export default defineMockRoute({
  handler({ params }) {
    const id = Number(params.id);
    const index = PROJECT_TASK_DB.findIndex((task) => task.id === id);
    const task = PROJECT_TASK_DB[index];
    if (!task) return bizError(404, '任务不存在');
    const projectId = task.projectId;

    PROJECT_TASK_DB.splice(index, 1);
    const logs = PROJECT_LOG_DB.filter((item) => item.taskId === id);
    logs.forEach((log) => {
      const logIndex = PROJECT_LOG_DB.indexOf(log);
      if (logIndex !== -1) PROJECT_LOG_DB.splice(logIndex, 1);
    });
    refreshProject(projectId);
    return success(null, '任务已删除');
  },
  method: 'DELETE',
  path: '/project/task/:id',
});
