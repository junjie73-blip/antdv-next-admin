import { CP_PROVIDER_DB } from '../../../../utils/db/ai-control-plane';
import { bizError, success } from '../../../../utils/response';
import { defineMockRoute } from '../../../../utils/runtime';

export default defineMockRoute({
  handler({ params }) {
    const id = Number(params.id);
    const index = CP_PROVIDER_DB.findIndex((item) => item.id === id);
    if (index === -1) return bizError(404, 'Provider不存在');
    CP_PROVIDER_DB.splice(index, 1);
    return success({ id }, 'Provider已删除');
  },
  method: 'DELETE',
  path: '/ai/control-plane/provider/:id',
});
