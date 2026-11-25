import { saveMaskPolicy } from '../../../utils/db/security-advanced';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ data }) {
    const result = saveMaskPolicy(data);
    if (!result.ok) return bizError(result.code, result.message);
    return success(result.data, result.message);
  },
  method: 'POST',
  path: '/security/mask-policy/save',
});
