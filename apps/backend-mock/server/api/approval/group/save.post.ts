import { saveGroup } from '../../../utils/db/approval';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 新建 / 编辑分组；编辑时只传 id + status 即可完成启停 */
export default defineMockRoute({
  handler({ data }) {
    const result = saveGroup(data);
    if (!result.ok) return bizError(result.code, result.message);
    return success(result.data, result.message);
  },
  method: 'POST',
  path: '/approval/group/save',
});
