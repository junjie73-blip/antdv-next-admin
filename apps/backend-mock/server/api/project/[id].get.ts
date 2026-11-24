import {
  decoratePhase,
  decorateProject,
  decorateTask,
  PROJECT_DB,
  PROJECT_LOG_DB,
  PROJECT_MEMBER_DB,
  PROJECT_PHASE_DB,
  PROJECT_TASK_DB,
} from '../../utils/db/project';
import { bizError, success } from '../../utils/response';
import { defineMockRoute } from '../../utils/runtime';

/**
 * 项目详情：一个接口带走项目 + 阶段 + 任务 + 成员 + 进度流水。
 * 页面从「项目列表 / 进度看板 / 甘特图」点进来都能拿到同一份完整数据。
 */
export default defineMockRoute({
  handler({ params }) {
    const id = Number(params.id);
    const project = PROJECT_DB.find((item) => item.id === id);
    if (!project) return bizError(404, '项目不存在');

    const phases = PROJECT_PHASE_DB.filter((item) => item.projectId === id)
      .sort((a, b) => a.orderNo - b.orderNo)
      .map(decoratePhase);
    const tasks = PROJECT_TASK_DB.filter((item) => item.projectId === id)
      .sort((a, b) => a.id - b.id)
      .map(decorateTask);
    const members = PROJECT_MEMBER_DB.filter((item) => item.projectId === id);
    const logs = PROJECT_LOG_DB.filter((item) => item.projectId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 20);

    return success(
      {
        logs,
        members,
        phases,
        project: decorateProject(project),
        tasks,
      },
      '获取项目详情成功',
    );
  },
  method: 'GET',
  path: '/project/:id',
});
