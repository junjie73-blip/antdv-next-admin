import { APPROVAL_GROUP_DB, summarizeGroups } from '../../../utils/db/approval';
import { paginateList } from '../../../utils/pagination';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 流程分组列表：状态 / 关键词筛选 + 统一分页，附带启停与流程数统计 */
export default defineMockRoute({
  handler({ query }) {
    const keyword = String(query.keyword ?? '')
      .trim()
      .toLowerCase();
    const filtered = APPROVAL_GROUP_DB.filter((row) => {
      const matchKeyword =
        !keyword ||
        [row.code, row.name, String(row.owner), row.description].some((field) =>
          field.toLowerCase().includes(keyword),
        );
      const matchStatus = !query.status || row.status === String(query.status);
      return matchKeyword && matchStatus;
    });

    return success(
      {
        ...paginateList(filtered, query),
        stats: summarizeGroups(),
      },
      '获取流程分组成功',
    );
  },
  method: 'GET',
  path: '/approval/group/list',
});
