import { resolveAccount } from '../../../utils/accounts';
import {
  canApproveRecord,
  ensureFlow,
  isApprovalSuperAdmin,
  refreshAssessment,
} from '../../../utils/approval-advanced';
import { APPROVAL_DB } from '../../../utils/db/approval';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 手动重新触发 AI 预研判：仅审批相关人/超管可用，结果写入审计台账 */
export default defineMockRoute({
  handler({ data, headers }) {
    const id = Number(data.id);
    if (!Number.isFinite(id)) return bizError(400, '缺少审批单据ID');
    const record = APPROVAL_DB.find((item) => item.id === id);
    if (!record) return bizError(404, '审批单据不存在或已被删除');

    const account = resolveAccount(headers);
    if (!isApprovalSuperAdmin(account) && !canApproveRecord(record, account))
      return bizError(403, '仅审批人或超级管理员可重新研判');
    ensureFlow(record);
    return success(refreshAssessment(record), 'AI 研判已更新');
  },
  method: 'POST',
  path: '/approval/ai/assess',
});
