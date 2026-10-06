import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler({ params }) {
    const id = Number(params.id);

    return success(null, `删除部门(ID: ${id})成功`);
  },
  method: 'DELETE',
  path: '/system/dept/:id',
});
