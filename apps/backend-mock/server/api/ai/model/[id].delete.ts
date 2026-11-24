import { deleteModel } from '../../../utils/db/ai';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 删除模型 */
export default defineMockRoute({
  handler({ params }) {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return bizError(400, '无效的模型ID');
    const result = deleteModel(id);
    if (!result.ok) return bizError(result.code, result.message);
    return success(result.data, result.message);
  },
  method: 'DELETE',
  path: '/ai/model/:id',
});
