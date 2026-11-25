import { resolveAccount } from '../../../utils/accounts';
import { deleteLevelRule } from '../../../utils/approval-advanced';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 删除审批层级规则：仅超级管理员 */
export default defineMockRoute({
  handler({ params, headers }) {
    const result = deleteLevelRule(Number(params.id), resolveAccount(headers));
    if (!result.ok) return bizError(result.code, result.message);
    return success(result.data, result.message);
  },
  method: 'DELETE',
  path: '/approval/level/:id',
});
