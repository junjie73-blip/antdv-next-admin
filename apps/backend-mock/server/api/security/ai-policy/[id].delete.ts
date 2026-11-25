import {
  removeSecurityRecord,
  SECURITY_AI_POLICIES,
} from '../../../utils/db/security-advanced';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ params }) {
    const id = Number(params.id);
    if (!removeSecurityRecord(SECURITY_AI_POLICIES, id))
      return bizError(404, 'AI 安全策略不存在或已被删除');
    return success({ id }, 'AI 安全策略已删除');
  },
  method: 'DELETE',
  path: '/security/ai-policy/:id',
});
