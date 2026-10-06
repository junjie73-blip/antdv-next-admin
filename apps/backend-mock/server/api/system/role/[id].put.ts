import { ROLE_DB } from '../../../utils/db/role';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ params, data }) {
    const id = Number(params.id);
    const idx = ROLE_DB.findIndex((r) => r.id === id);

    if (idx === -1) {
      return bizError(404, '角色不存在');
    }

    ROLE_DB[idx] = {
      ...ROLE_DB[idx]!,
      ...(data.name !== undefined && { name: String(data.name) }),
      ...(data.code !== undefined && { code: String(data.code) }),
      ...(data.description !== undefined && {
        description: String(data.description),
      }),
      ...(data.sort !== undefined && { sort: Number(data.sort) }),
      ...(data.status !== undefined && { status: Number(data.status) }),
    };

    return success(ROLE_DB[idx], '更新角色成功');
  },
  method: 'PUT',
  path: '/system/role/:id',
});
