import {
  MEMBER_ROLE_LABELS,
  PROJECT_MEMBER_DB,
} from '../../../utils/db/project';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 编辑成员角色 / 部门 / 账号状态；项目负责人仍不可被停用 */
export default defineMockRoute({
  handler({ data, params }) {
    const index = PROJECT_MEMBER_DB.findIndex(
      (item) => item.id === Number(params.id),
    );
    const current = PROJECT_MEMBER_DB[index];
    if (!current) return bizError(404, '成员不存在');
    if (
      data.role !== undefined &&
      !MEMBER_ROLE_LABELS[data.role as keyof typeof MEMBER_ROLE_LABELS]
    )
      return bizError(400, '项目角色不合法');
    if (current.role === 'owner' && data.status === 'disabled')
      return bizError(400, '项目负责人不可停用');

    const next = {
      ...current,
      dept: String(data.dept ?? current.dept),
      email: String(data.email ?? current.email),
      role: (data.role ?? current.role) as never,
      status: (data.status ?? current.status) as never,
    };
    PROJECT_MEMBER_DB[index] = next;
    return success(next, '成员信息已更新');
  },
  method: 'PUT',
  path: '/project/member/:id',
});
