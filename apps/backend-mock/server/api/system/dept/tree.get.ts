import { buildDeptTree } from '../../../utils/db/dept';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 部门树按 parentId 从真实存储实时组装，新增/编辑/删除后立即可见 */
export default defineMockRoute({
  handler: () => success(buildDeptTree(), '获取部门树成功'),
  method: 'GET',
  path: '/system/dept/tree',
});
