import { saveModel } from '../../../utils/db/ai';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/**
 * 新建 / 编辑模型。
 * providerId 必须指向存在的供应商；providerName 由 db 层按关联表回填，不信客户端传值。
 */
export default defineMockRoute({
  handler({ data }) {
    const result = saveModel(data);
    if (!result.ok) return bizError(result.code, result.message);
    return success(result.data, result.message);
  },
  method: 'POST',
  path: '/ai/model/save',
});
