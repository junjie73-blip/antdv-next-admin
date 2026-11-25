import { ROLE_DB } from '../../../utils/db/role';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ params }) {
    const id = Number(params.id);
    const role = ROLE_DB.find((r) => r.id === id);

    if (!role) {
      return bizError(404, '角色不存在');
    }

    if (role.code === 'super_admin') {
      return bizError(400, '超级管理员角色不允许删除');
    }

    const idx = ROLE_DB.findIndex((r) => r.id === id);
    ROLE_DB.splice(idx, 1);

    return success(null, '删除角色成功');
  },
  method: 'DELETE',
  path: '/system/role/:id',
});
