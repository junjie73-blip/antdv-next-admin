import {
  APPROVAL_INSTANCE_DB,
  summarizeInstances,
} from '../../../utils/db/approval';
import { paginateList } from '../../../utils/pagination';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 流程实例列表（只读）：状态 / 关键词筛选 + 统一分页，附带监控统计 */
export default defineMockRoute({
  handler({ query }) {
    const keyword = String(query.keyword ?? '')
      .trim()
      .toLowerCase();
    const filtered = APPROVAL_INSTANCE_DB.filter((row) => {
      const matchKeyword =
        !keyword ||
        [row.code, row.name, row.groupName, row.node, row.owner].some((field) =>
          field.toLowerCase().includes(keyword),
        );
      const matchStatus = !query.status || row.status === String(query.status);
      return matchKeyword && matchStatus;
    });

    return success(
      {
        ...paginateList(filtered, query),
        stats: summarizeInstances(),
      },
      '获取流程实例成功',
    );
  },
  method: 'GET',
  path: '/approval/monitor/list',
});
