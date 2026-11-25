import { resolveAccount } from '../../../utils/accounts';
import {
  applyApprovalAction,
  ensureFlow,
} from '../../../utils/approval-advanced';
import { APPROVAL_DB, summarizeApprovals } from '../../../utils/db/approval';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/**
 * 审批通过 / 驳回：权限校验、多级节点流转都在 approval-advanced 里完成。
 * 只有当前节点审批人 / 直接上级 / 超级管理员可以处理，绕过页面直接调接口同样会被拒。
 */
export default defineMockRoute({
  handler({ data, headers }) {
    const id = Number(data.id);
    if (!Number.isFinite(id)) return bizError(400, '缺少审批单据ID');
    const record = APPROVAL_DB.find((item) => item.id === id);
    if (!record) return bizError(404, '审批单据不存在或已被删除');

    const account = resolveAccount(headers);
    ensureFlow(record);
    const result = applyApprovalAction(
      record,
      String(data.action ?? ''),
      String(data.reason ?? ''),
      account,
    );
    if (!result.ok) return bizError(result.code, result.message);
    return success(
      {
        approval: result.data!.approval,
        stats: summarizeApprovals(account.profile.username),
      },
      result.message,
    );
  },
  method: 'POST',
  path: '/approval/mine/action',
});
