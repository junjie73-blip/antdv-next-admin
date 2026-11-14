import { WORKFLOW_STORE } from '../../../utils/db/enterprise';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 删除流程定义 */
export default defineMockRoute({
  handler({ params }) {
    const id = String(params.id ?? '');
    const index = WORKFLOW_STORE.items.findIndex((item) => item.id === id);
    if (index === -1) return bizError(404, '流程不存在或已被删除');
    WORKFLOW_STORE.items.splice(index, 1);
    return success({ id }, '流程已删除');
  },
  method: 'DELETE',
  path: '/enterprise/workflow/:id',
});
