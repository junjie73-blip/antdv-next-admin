import { resolveAccount } from '../../../utils/accounts';
import { ensureFlow, resubmitApproval } from '../../../utils/approval-advanced';
import { APPROVAL_DB, summarizeApprovals } from '../../../utils/db/approval';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/**
 * 驳回重提：在原单据后追加一轮完整流程，历史节点原样保留。
 * 只有发起人本人可操作；金额、类型、申请人、所属分组沿用原材料。
 */
export default defineMockRoute({
  handler({ data, headers }) {
    const id = Number(data.id);
    if (!Number.isFinite(id)) return bizError(400, '缺少审批单据ID');
    const record = APPROVAL_DB.find((item) => item.id === id);
    if (!record) return bizError(404, '审批单据不存在或已被删除');

    const account = resolveAccount(headers);
    ensureFlow(record);
    const result = resubmitApproval(record, data.reason, account);
    if (!result.ok) return bizError(result.code, result.message);
    return success(
      {
        approval: result.data,
        stats: summarizeApprovals(account.profile.username),
      },
      result.message,
    );
  },
  method: 'POST',
  path: '/approval/mine/resubmit',
});
