import { DEPT_MAP, POST_DB } from '../../../utils/db/post';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ params, data }) {
    const id = Number(params.id);
    const idx = POST_DB.findIndex((p) => p.id === id);

    if (idx === -1) {
      return bizError(404, '岗位不存在');
    }

    POST_DB[idx] = {
      ...POST_DB[idx]!,
      ...(data.name !== undefined && { name: String(data.name) }),
      ...(data.code !== undefined && { code: String(data.code) }),
      ...(data.deptId !== undefined && {
        deptId: Number(data.deptId),
        deptName: DEPT_MAP[Number(data.deptId)] || '',
      }),
      ...(data.sortOrder !== undefined && {
        sortOrder: Number(data.sortOrder),
      }),
      ...(data.status !== undefined && { status: data.status as 0 | 1 }),
      ...(data.remark !== undefined && { remark: String(data.remark) }),
    };

    return success(POST_DB[idx], '更新岗位成功');
  },
  method: 'PUT',
  path: '/system/post/:id',
});
