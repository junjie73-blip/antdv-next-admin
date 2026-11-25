import { AI_AGENT_DB } from '../../../utils/db/ai';
import { paginateList } from '../../../utils/pagination';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** Agent 列表：只返回 Agent 自身配置，关键词与状态筛选 + 统一分页 */
export default defineMockRoute({
  handler({ query }) {
    const keyword = String(query.keyword ?? '')
      .trim()
      .toLowerCase();
    const filtered = AI_AGENT_DB.filter((row) => {
      const matchKeyword =
        !keyword ||
        [row.code, row.name, row.owner, ...row.tags].some((field) =>
          String(field).toLowerCase().includes(keyword),
        );
      const matchStatus = !query.status || row.status === String(query.status);
      return matchKeyword && matchStatus;
    });

    return success(paginateList(filtered, query), '获取 Agent 成功');
  },
  method: 'GET',
  path: '/ai/agent/list',
});
