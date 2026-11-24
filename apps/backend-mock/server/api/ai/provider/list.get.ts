import { AI_PROVIDER_DB, summarizeProviders } from '../../../utils/db/ai';
import { paginateList } from '../../../utils/pagination';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 模型供应商列表：状态 / 关键词筛选 + 统一分页（只返回脱敏串，绝不返回明文 key） */
export default defineMockRoute({
  handler({ query }) {
    const keyword = String(query.keyword ?? '')
      .trim()
      .toLowerCase();
    const filtered = AI_PROVIDER_DB.filter((row) => {
      const matchKeyword =
        !keyword ||
        [row.code, row.name, row.endpoint, row.description, row.keyMasked].some(
          (field) => String(field).toLowerCase().includes(keyword),
        );
      const matchStatus = !query.status || row.status === String(query.status);
      return matchKeyword && matchStatus;
    });

    return success(
      {
        ...paginateList(filtered, query),
        stats: summarizeProviders(),
      },
      '获取模型供应商成功',
    );
  },
  method: 'GET',
  path: '/ai/provider/list',
});
