import { resolveAccount } from '../../../utils/accounts';
import {
  decorateTask,
  ownersForAccount,
  PROJECT_DB,
  PROJECT_TASK_DB,
} from '../../../utils/db/project';
import { paginateList } from '../../../utils/pagination';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 任务列表：项目/阶段/状态/优先级/关键词/我的任务；返回项目名给表格直接展示 */
export default defineMockRoute({
  handler({ headers, query }) {
    const keyword = String(query.keyword ?? '')
      .trim()
      .toLowerCase();
    const mine =
      String(query.mine ?? '') === 'true' || String(query.mine ?? '') === '1';
    const owners = mine
      ? ownersForAccount(resolveAccount(headers).profile.username)
      : [];
    const projectNames = new Map(
      PROJECT_DB.map((item) => [item.id, item.name]),
    );

    const filtered = PROJECT_TASK_DB.filter((task) => {
      const matchKeyword =
        !keyword ||
        [task.title, task.owner, task.remark].some((value) =>
          value.toLowerCase().includes(keyword),
        );
      const matchProject =
        !query.projectId || task.projectId === Number(query.projectId);
      const matchPhase =
        !query.phaseId || task.phaseId === Number(query.phaseId);
      const matchStatus = !query.status || task.status === String(query.status);
      const matchPriority =
        !query.priority || task.priority === String(query.priority);
      const matchOwner = !mine || owners.includes(task.owner);
      return (
        matchKeyword &&
        matchProject &&
        matchPhase &&
        matchStatus &&
        matchPriority &&
        matchOwner
      );
    })
      .map((task) => ({
        ...decorateTask(task),
        projectName: projectNames.get(task.projectId) ?? '',
      }))
      .sort((a, b) => a.id - b.id);

    return success(paginateList(filtered, query), '获取任务列表成功');
  },
  method: 'GET',
  path: '/project/task/list',
});
