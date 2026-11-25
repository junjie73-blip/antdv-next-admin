import { AI_KNOWLEDGE_DB, summarizeKnowledge } from '../../../utils/db/ai';
import { paginateList } from '../../../utils/pagination';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 知识库列表：状态 / 关键词筛选 + 统一分页 */
export default defineMockRoute({
  handler({ query }) {
    const keyword = String(query.keyword ?? '')
      .trim()
      .toLowerCase();
    const filtered = AI_KNOWLEDGE_DB.filter((row) => {
      const matchKeyword =
        !keyword ||
        [row.code, row.name, row.scope, row.vectorModel].some((field) =>
          String(field).toLowerCase().includes(keyword),
        );
      const matchStatus = !query.status || row.status === String(query.status);
      return matchKeyword && matchStatus;
    });

    return success(
      {
        ...paginateList(filtered, query),
        stats: summarizeKnowledge(),
      },
      '获取知识库成功',
    );
  },
  method: 'GET',
  path: '/ai/knowledge/list',
});
