import { CP_CONTEXT_DB } from '../../../../utils/db/ai-control-plane';
import { bizError, success } from '../../../../utils/response';
import { defineMockRoute } from '../../../../utils/runtime';

export default defineMockRoute({
  handler({ params }) {
    const id = Number(params.id);
    const index = CP_CONTEXT_DB.findIndex((item) => item.id === id);
    if (index === -1) return bizError(404, 'Context 策略不存在');
    CP_CONTEXT_DB.splice(index, 1);
    return success({ id }, 'Context 策略已删除');
  },
  method: 'DELETE',
  path: '/ai/control-plane/context/:id',
});
