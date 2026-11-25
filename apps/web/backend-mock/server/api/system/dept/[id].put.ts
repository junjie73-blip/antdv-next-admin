import { ALL_DEPTS_FLAT } from '../../../utils/db/dept';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ params, data }) {
    const id = Number(params.id);
    const idx = ALL_DEPTS_FLAT.findIndex((dept) => dept.id === id);
    if (idx === -1) return bizError(404, '部门不存在');

    // 真实更新：合并到已存储记录，保留 createdAt / userCount 等未提交字段
    const updated = {
      ...ALL_DEPTS_FLAT[idx]!,
      ...(data.parentId !== undefined && { parentId: Number(data.parentId) }),
      ...(data.name !== undefined && { name: String(data.name) }),
      ...(data.code !== undefined && { code: String(data.code) }),
      ...(data.leader !== undefined && { leader: String(data.leader) }),
      ...(data.phone !== undefined && { phone: String(data.phone) }),
      ...(data.sortOrder !== undefined && {
        sortOrder: Number(data.sortOrder),
      }),
      ...(data.status !== undefined && { status: data.status as 0 | 1 }),
      ...(data.remark !== undefined && { remark: String(data.remark) }),
    };
    ALL_DEPTS_FLAT[idx] = updated;

    return success(updated, '更新部门成功');
  },
  method: 'PUT',
  path: '/system/dept/:id',
});
