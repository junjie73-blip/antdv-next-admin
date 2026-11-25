import { saveAgent } from '../../../utils/db/ai';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 新建 / 编辑 Agent：只接受 Agent 自身字段，db 层字段白名单兜底 */
export default defineMockRoute({
  handler({ data }) {
    const result = saveAgent(data);
    if (!result.ok) return bizError(result.code, result.message);
    return success(result.data, result.message);
  },
  method: 'POST',
  path: '/ai/agent/save',
});
