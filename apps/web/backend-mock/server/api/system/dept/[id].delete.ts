import { ALL_DEPTS_FLAT } from '../../../utils/db/dept';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ params }) {
    const id = Number(params.id);
    const idx = ALL_DEPTS_FLAT.findIndex((dept) => dept.id === id);
    if (idx === -1) return bizError(404, '部门不存在');

    // 真实删除（SQLite 下为软删除）；返回结构保持 data: null
    ALL_DEPTS_FLAT.splice(idx, 1);

    return success(null, `删除部门(ID: ${id})成功`);
  },
  method: 'DELETE',
  path: '/system/dept/:id',
});
