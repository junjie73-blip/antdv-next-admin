import { SECURITY_AI_POLICIES } from '../../../utils/db/security-advanced';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler() {
    return success([...SECURITY_AI_POLICIES], 'ok');
  },
  method: 'GET',
  path: '/security/ai-policy/list',
});
