import { resolveAccount } from '../../../utils/accounts';
import { ensureFlow, extendApproval } from '../../../utils/approval-advanced';
import { APPROVAL_DB } from '../../../utils/db/approval';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 追加审批人 / 抄送对象：服务端校验当前节点权限，支持会签与顺序审批 */
export default defineMockRoute({
  handler({ data, headers }) {
    const id = Number(data.id);
    if (!Number.isFinite(id)) return bizError(400, '缺少审批单据ID');
    const record = APPROVAL_DB.find((item) => item.id === id);
    if (!record) return bizError(404, '审批单据不存在或已被删除');

    ensureFlow(record);
    const result = extendApproval(record, data, resolveAccount(headers));
    if (!result.ok) return bizError(result.code, result.message);
    return success(result.data, result.message);
  },
  method: 'POST',
  path: '/approval/mine/extend',
});
