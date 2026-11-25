import { resolveAccount } from '../../../utils/accounts';
import { canEditRecord } from '../../../utils/approval-advanced';
import { deleteApproval, findApproval } from '../../../utils/db/approval';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 删除审批单据：仅发起人本人可删 */
export default defineMockRoute({
  handler({ params, headers }) {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return bizError(400, '无效的审批单据ID');
    const record = findApproval(id);
    if (!record) return bizError(404, '审批单据不存在或已被删除');
    if (!canEditRecord(record, resolveAccount(headers)))
      return bizError(403, '只能删除自己发起的审批单据');

    const result = deleteApproval(id);
    if (!result.ok) return bizError(result.code, result.message);
    return success(result.data, result.message);
  },
  method: 'DELETE',
  path: '/approval/mine/:id',
});
