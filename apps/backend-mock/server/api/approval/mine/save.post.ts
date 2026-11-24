import { saveApproval } from '../../../utils/db/approval';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 新建 / 编辑审批单据：必填校验与字段白名单在 db 层，失败转 bizError */
export default defineMockRoute({
  handler({ data }) {
    const result = saveApproval(data);
    if (!result.ok) return bizError(result.code, result.message);
    return success(result.data, result.message);
  },
  method: 'POST',
  path: '/approval/mine/save',
});
