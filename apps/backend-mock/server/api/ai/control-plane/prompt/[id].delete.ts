import { CP_PROMPT_DB } from '../../../../utils/db/ai-control-plane';
import { bizError, success } from '../../../../utils/response';
import { defineMockRoute } from '../../../../utils/runtime';

export default defineMockRoute({
  handler({ params }) {
    const id = Number(params.id);
    const index = CP_PROMPT_DB.findIndex((item) => item.id === id);
    if (index === -1) return bizError(404, 'Prompt 模板不存在');
    CP_PROMPT_DB.splice(index, 1);
    return success({ id }, 'Prompt 模板已删除');
  },
  method: 'DELETE',
  path: '/ai/control-plane/prompt/:id',
});
