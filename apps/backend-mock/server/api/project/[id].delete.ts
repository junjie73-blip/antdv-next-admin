import {
  PROJECT_DB,
  PROJECT_LOG_DB,
  PROJECT_MEMBER_DB,
  PROJECT_PHASE_DB,
  PROJECT_TASK_DB,
} from '../../utils/db/project';
import { bizError, success } from '../../utils/response';
import { defineMockRoute } from '../../utils/runtime';

/** 删除项目：级联清理阶段/任务/成员/流水，避免留下孤儿数据 */
export default defineMockRoute({
  handler({ params }) {
    const id = Number(params.id);
    const index = PROJECT_DB.findIndex((item) => item.id === id);
    if (index === -1) return bizError(404, '项目不存在');

    // 每张表单独按 id 倒序删：splice 会改变下标，正序删除会跳过相邻行
    [...PROJECT_PHASE_DB.keys()]
      .filter((key) => PROJECT_PHASE_DB[key]?.projectId === id)
      .reverse()
      .forEach((key) => PROJECT_PHASE_DB.splice(key, 1));
    [...PROJECT_TASK_DB.keys()]
      .filter((key) => PROJECT_TASK_DB[key]?.projectId === id)
      .reverse()
      .forEach((key) => PROJECT_TASK_DB.splice(key, 1));
    [...PROJECT_MEMBER_DB.keys()]
      .filter((key) => PROJECT_MEMBER_DB[key]?.projectId === id)
      .reverse()
      .forEach((key) => PROJECT_MEMBER_DB.splice(key, 1));
    [...PROJECT_LOG_DB.keys()]
      .filter((key) => PROJECT_LOG_DB[key]?.projectId === id)
      .reverse()
      .forEach((key) => PROJECT_LOG_DB.splice(key, 1));

    PROJECT_DB.splice(index, 1);
    return success(null, '项目已删除');
  },
  method: 'DELETE',
  path: '/project/:id',
});
