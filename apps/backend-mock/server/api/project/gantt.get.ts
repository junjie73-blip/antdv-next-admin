import {
  delayInfo,
  PROJECT_DB,
  PROJECT_PHASE_DB,
  PROJECT_TASK_DB,
} from '../../utils/db/project';
import { success } from '../../utils/response';
import { defineMockRoute } from '../../utils/runtime';

/**
 * 甘特图数据：阶段（含里程碑）+ 任务同图展示。
 * id 加前缀保证两类行不撞；依赖只指向任务行，阶段行不画依赖箭头。
 */
export default defineMockRoute({
  handler({ query }) {
    const projectId = query.projectId ? Number(query.projectId) : undefined;
    const project = projectId
      ? PROJECT_DB.find((item) => item.id === projectId)
      : undefined;
    if (projectId && !project) return success({ projectName: '', rows: [] });

    const phases = PROJECT_PHASE_DB.filter(
      (phase) => !projectId || phase.projectId === projectId,
    ).sort((a, b) => a.orderNo - b.orderNo);
    const tasks = PROJECT_TASK_DB.filter(
      (task) => !projectId || task.projectId === projectId,
    );

    // 延期直接写进条形名称：甘特库不支持自定义状态色，但文字标记在画布上同样一眼可见
    const rows = [
      ...phases.map((phase) => {
        const delay = delayInfo(phase.endDate, phase.status);
        return {
          ...delay,
          deps: '',
          end: phase.endDate,
          id: `p${phase.id}`,
          kind: phase.isMilestone ? 'milestone' : 'phase',
          name: `${phase.isMilestone ? '◆ ' : ''}${phase.name}${delay.delayed ? `（延期${delay.delayDays}天）` : ''}`,
          owner: phase.owner,
          phase: '',
          progress: phase.progress,
          projectId: phase.projectId,
          start: phase.startDate,
          status: phase.status,
        };
      }),
      ...tasks.map((task) => {
        const delay = delayInfo(task.dueDate, task.status);
        return {
          ...delay,
          deps: task.dependsOn
            .split(/[\s,;]+/u)
            .filter(Boolean)
            .map((id) => `t${id}`)
            .join(','),
          end: task.dueDate,
          id: `t${task.id}`,
          kind: 'task',
          name: `${task.title}${delay.delayed ? `（延期${delay.delayDays}天）` : ''}`,
          owner: task.owner,
          phase: `p${task.phaseId}`,
          progress: task.progress,
          projectId: task.projectId,
          start: task.startDate,
          status: task.status,
        };
      }),
    ];

    return success({
      projectName: project?.name ?? '',
      rows,
    });
  },
  method: 'GET',
  path: '/project/gantt',
});
