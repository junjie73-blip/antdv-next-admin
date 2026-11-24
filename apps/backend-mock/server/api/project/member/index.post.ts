import {
  nextMemberId,
  PROJECT_DB,
  PROJECT_MEMBER_DB,
} from '../../../utils/db/project';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 添加项目成员：同项目同姓名不重复添加 */
export default defineMockRoute({
  handler({ data }) {
    const name = String(data.name ?? '').trim();
    if (!name) return bizError(400, '成员姓名不能为空');
    const projectId = Number(data.projectId);
    if (!PROJECT_DB.some((item) => item.id === projectId))
      return bizError(404, '项目不存在');
    if (
      PROJECT_MEMBER_DB.some(
        (item) => item.projectId === projectId && item.name === name,
      )
    )
      return bizError(400, '该成员已在项目中');

    const member = {
      dept: String(data.dept ?? ''),
      email: String(data.email ?? ''),
      id: nextMemberId(),
      name,
      projectId,
      role: (data.role || 'dev') as never,
      status: 'enabled' as const,
    };
    PROJECT_MEMBER_DB.push(member);
    return success(member, '成员添加成功');
  },
  method: 'POST',
  path: '/project/member',
});
