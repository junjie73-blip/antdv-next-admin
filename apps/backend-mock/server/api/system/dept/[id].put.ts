import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ params, data }) {
    const id = Number(params.id);

    const updated = {
      id,
      parentId: Number(data.parentId ?? 0),
      name: String(data.name || ''),
      code: String(data.code || ''),
      leader: String(data.leader || ''),
      phone: String(data.phone || ''),
      sortOrder: Number(data.sortOrder ?? 0),
      status: (data.status as 0 | 1) ?? 1,
      remark: String(data.remark || ''),
    };

    return success(updated, '更新部门成功');
  },
  method: 'PUT',
  path: '/system/dept/:id',
});
