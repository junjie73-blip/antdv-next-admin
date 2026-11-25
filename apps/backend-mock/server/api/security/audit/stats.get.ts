/** 审计与 AI 调用的安全运营指标 */
import { summarizeSecurityOperations } from '../../../utils/db/security-advanced';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler() {
    return success(summarizeSecurityOperations(), 'ok');
  },
  method: 'GET',
  path: '/security/audit/stats',
});
