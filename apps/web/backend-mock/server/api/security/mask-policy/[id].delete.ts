import {
  removeSecurityRecord,
  SECURITY_MASK_POLICIES,
} from '../../../utils/db/security-advanced';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ params }) {
    const id = Number(params.id);
    if (!removeSecurityRecord(SECURITY_MASK_POLICIES, id))
      return bizError(404, '脱敏策略不存在或已被删除');
    return success({ id }, '脱敏策略已删除');
  },
  method: 'DELETE',
  path: '/security/mask-policy/:id',
});
