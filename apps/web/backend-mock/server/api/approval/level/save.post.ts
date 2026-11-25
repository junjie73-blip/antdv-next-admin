import { resolveAccount } from '../../../utils/accounts';
import { saveLevelRule } from '../../../utils/approval-advanced';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 新增 / 编辑审批层级规则：仅超级管理员 */
export default defineMockRoute({
  handler({ data, headers }) {
    const result = saveLevelRule(data, resolveAccount(headers));
    if (!result.ok) return bizError(result.code, result.message);
    return success(result.data, result.message);
  },
  method: 'POST',
  path: '/approval/level/save',
});
