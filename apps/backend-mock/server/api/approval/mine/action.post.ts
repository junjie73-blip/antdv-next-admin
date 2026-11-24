import { resolveAccount } from '../../../utils/accounts';
import {
  summarizeApprovals,
  transitionApproval,
} from '../../../utils/db/approval';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 审批通过 / 驳回：只有 pending 单据可流转，非法流转返回业务错误 */
export default defineMockRoute({
  handler({ data, headers }) {
    const id = Number(data.id);
    if (!Number.isFinite(id)) return bizError(400, '缺少审批单据ID');
    const result = transitionApproval(
      id,
      String(data.action ?? ''),
      String(data.reason ?? ''),
    );
    if (!result.ok) return bizError(result.code, result.message);
    return success(
      {
        approval: result.data,
        stats: summarizeApprovals(resolveAccount(headers).profile.username),
      },
      result.message,
    );
  },
  method: 'POST',
  path: '/approval/mine/action',
});
