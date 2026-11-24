import { deleteApproval } from '../../../utils/db/approval';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 删除审批单据 */
export default defineMockRoute({
  handler({ params }) {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return bizError(400, '无效的审批单据ID');
    const result = deleteApproval(id);
    if (!result.ok) return bizError(result.code, result.message);
    return success(result.data, result.message);
  },
  method: 'DELETE',
  path: '/approval/mine/:id',
});
