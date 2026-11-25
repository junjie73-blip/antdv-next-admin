import { CP_TRACE_DB } from '../../../../utils/db/ai-control-plane';
import { success } from '../../../../utils/response';
import { defineMockRoute } from '../../../../utils/runtime';

export default defineMockRoute({
  handler() {
    return success([...CP_TRACE_DB], 'ok');
  },
  method: 'GET',
  path: '/ai/control-plane/trace/list',
});
