import {
  aiPolicySnapshot,
  maskPolicySnapshot,
} from '../../../utils/db/security-advanced';
import { assessPrompt, moderateOutput } from '../../../utils/security/ai-guard';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 安全策略演练：不落审计，只返回当前策略下的判定与脱敏结果 */
export default defineMockRoute({
  handler({ data }) {
    const text = String(data.text ?? '');
    const mode = String(data.mode ?? 'prompt');
    if (!text.trim()) return bizError(400, '请输入待检测的文案');
    const aiPolicies = aiPolicySnapshot();
    const maskPolicies = maskPolicySnapshot();
    if (mode === 'output') {
      return success(moderateOutput(text, aiPolicies, maskPolicies), 'ok');
    }
    return success(assessPrompt(text, aiPolicies, maskPolicies), 'ok');
  },
  method: 'POST',
  path: '/security/guard/preview',
});
