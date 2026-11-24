import { AI_FLOW_DB, summarizeFlows } from '../../../utils/db/ai';
import { paginateList } from '../../../utils/pagination';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** AI 工作流编排应用元数据列表（对应编排画布保存的流程定义） */
export default defineMockRoute({
  handler({ query }) {
    const keyword = String(query.keyword ?? '')
      .trim()
      .toLowerCase();
    const filtered = AI_FLOW_DB.filter((row) => {
      const matchKeyword =
        !keyword ||
        [row.code, row.name, row.description].some((field) =>
          String(field).toLowerCase().includes(keyword),
        );
      const matchStatus = !query.status || row.status === String(query.status);
      return matchKeyword && matchStatus;
    });

    return success(
      {
        ...paginateList(filtered, query),
        stats: summarizeFlows(),
      },
      '获取编排列表成功',
    );
  },
  method: 'GET',
  path: '/ai/flow/list',
});
