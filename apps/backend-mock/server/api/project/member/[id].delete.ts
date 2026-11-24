import { PROJECT_MEMBER_DB } from '../../../utils/db/project';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 移除项目成员：负责人不可移除（项目需要有人负责进度） */
export default defineMockRoute({
  handler({ params }) {
    const id = Number(params.id);
    const index = PROJECT_MEMBER_DB.findIndex((item) => item.id === id);
    const member = PROJECT_MEMBER_DB[index];
    if (!member) return bizError(404, '成员不存在');
    if (member.role === 'owner')
      return bizError(400, '项目负责人不可移除，请先更换负责人');
    PROJECT_MEMBER_DB.splice(index, 1);
    return success(null, '成员已移除');
  },
  method: 'DELETE',
  path: '/project/member/:id',
});
