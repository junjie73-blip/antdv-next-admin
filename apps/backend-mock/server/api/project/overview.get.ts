import {
  decoratePhase,
  decorateProject,
  decorateTask,
  PROJECT_DB,
  PROJECT_LOG_DB,
  PROJECT_PHASE_DB,
  PROJECT_TASK_DB,
} from '../../utils/db/project';
import { success } from '../../utils/response';
import { defineMockRoute } from '../../utils/runtime';

/**
 * 进度看板：所有数字都从同一份库实时算出。
 * 延期只看「未完成且已过截止日」，与列表/甘特用的是同一个 delayInfo。
 */
export default defineMockRoute({
  handler() {
    const projects = PROJECT_DB.map(decorateProject);
    const projectNames = new Map(
      PROJECT_DB.map((item) => [item.id, item.name]),
    );
    const tasks = PROJECT_TASK_DB.map((task) => ({
      ...decorateTask(task),
      projectName: projectNames.get(task.projectId) ?? '',
    }));
    const phases = PROJECT_PHASE_DB;
    const milestones = phases
      .filter((phase) => phase.isMilestone)
      .map(decoratePhase);

    const recentLogs = [...PROJECT_LOG_DB]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 8);

    return success({
      delayedProjects: projects.filter((item) => item.delayed),
      delayedTasks: tasks.filter((item) => item.delayed).slice(0, 10),
      milestones: {
        delayed: milestones.filter((phase) => phase.delayed).length,
        done: milestones.filter((phase) => phase.status === 'done').length,
        total: milestones.length,
      },
      projects: projects.map((item) => ({
        id: item.id,
        name: item.name,
        owner: item.owner,
        planEndDate: item.planEndDate,
        progress: item.progress,
        status: item.status,
        delayed: item.delayed,
        delayDays: item.delayDays,
      })),
      recentLogs,
      stats: {
        projectTotal: projects.length,
        projectActive: projects.filter((item) => item.status === 'active')
          .length,
        projectDone: projects.filter((item) => item.status === 'done').length,
        projectDelayed: projects.filter((item) => item.delayed).length,
        taskTotal: tasks.length,
        taskPending: tasks.filter(
          (item) => item.status === 'pending' || item.status === 'blocked',
        ).length,
        taskRunning: tasks.filter((item) => item.status === 'running').length,
        taskDone: tasks.filter((item) => item.status === 'done').length,
        taskDelayed: tasks.filter((item) => item.delayed).length,
      },
    });
  },
  method: 'GET',
  path: '/project/overview',
});
