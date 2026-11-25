import { resolveAccount } from '../../../utils/accounts';
import {
  canEditRecord,
  enrichRecord,
  ensureFlow,
} from '../../../utils/approval-advanced';
import { findApproval, saveApproval } from '../../../utils/db/approval';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/**
 * 新建 / 编辑审批单据：必填校验与字段白名单在 db 层。
 * 编辑额外校验发起人身份，只有本人能改自己的单据。
 * 新建成功后立即初始化审批节点，返回给前端的就是可直接渲染的进度数据。
 */
export default defineMockRoute({
  handler({ data, headers }) {
    const account = resolveAccount(headers);
    const rawId = data.id;
    const editing = rawId !== undefined && rawId !== null && rawId !== '';
    if (editing) {
      const existing = findApproval(Number(rawId));
      if (!existing) return bizError(404, '审批单据不存在或已被删除');
      if (!canEditRecord(existing, account))
        return bizError(403, '只能编辑自己发起的审批单据');
    }

    const result = saveApproval(data);
    if (!result.ok) return bizError(result.code, result.message);

    const record = result.data!;
    ensureFlow(record);
    return success(enrichRecord(record, account), result.message);
  },
  method: 'POST',
  path: '/approval/mine/save',
});
