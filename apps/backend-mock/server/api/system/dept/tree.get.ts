import { DEPT_TREE } from '../../../utils/db/dept';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler: () => success(DEPT_TREE, '获取部门树成功'),
  method: 'GET',
  path: '/system/dept/tree',
});
