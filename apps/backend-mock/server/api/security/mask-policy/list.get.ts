import { SECURITY_MASK_POLICIES } from '../../../utils/db/security-advanced';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler() {
    return success([...SECURITY_MASK_POLICIES], 'ok');
  },
  method: 'GET',
  path: '/security/mask-policy/list',
});
