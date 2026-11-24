import { listModelsWithProvider, summarizeModels } from '../../../utils/db/ai';
import { paginateList } from '../../../utils/pagination';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 模型列表：状态 / 供应商 / 关键词筛选 + 统一分页，providerName 由 db 层关联回填 */
export default defineMockRoute({
  handler({ query }) {
    const keyword = String(query.keyword ?? '')
      .trim()
      .toLowerCase();
    const filtered = listModelsWithProvider().filter((row) => {
      const matchKeyword =
        !keyword ||
        [row.code, row.name, row.providerName, row.protocol].some((field) =>
          String(field).toLowerCase().includes(keyword),
        );
      const matchStatus = !query.status || row.status === String(query.status);
      const matchProvider =
        !query.providerId || row.providerId === Number(query.providerId);
      return matchKeyword && matchStatus && matchProvider;
    });

    return success(
      {
        ...paginateList(filtered, query),
        stats: summarizeModels(),
      },
      '获取模型列表成功',
    );
  },
  method: 'GET',
  path: '/ai/model/list',
});
