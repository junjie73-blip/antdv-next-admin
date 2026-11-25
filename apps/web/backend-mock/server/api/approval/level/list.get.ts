import { APPROVAL_LEVEL_DB } from '../../../utils/approval-advanced';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 审批层级规则列表：员工 → 直接上级 / 审批层级 / 处理时限 */
export default defineMockRoute({
  handler() {
    const list = [...APPROVAL_LEVEL_DB].sort((a, b) => a.id - b.id);
    return success({ list, total: list.length }, '获取层级规则成功');
  },
  method: 'GET',
  path: '/approval/level/list',
});
