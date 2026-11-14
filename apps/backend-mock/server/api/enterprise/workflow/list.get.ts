import {
  paginate,
  selectWorkflowDefinitions,
  summarizeWorkflowDefinitions,
  WORKFLOW_CATEGORIES,
  WORKFLOW_OWNERS,
  WORKFLOW_STORE,
} from '../../../utils/db/enterprise';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 流程定义列表：四路筛选 + 三种排序 + 分页，附带头部统计与下拉选项 */
export default defineMockRoute({
  handler({ query }) {
    const selected = selectWorkflowDefinitions(WORKFLOW_STORE.items, {
      category: String(query.category ?? ''),
      keyword: String(query.keyword ?? ''),
      owner: String(query.owner ?? ''),
      sort: String(query.sort ?? 'updated'),
      status: String(query.status ?? ''),
    });
    const result = paginate(selected, query.pageNum, query.pageSize);
    return success(
      {
        categories: WORKFLOW_CATEGORIES,
        list: result.list,
        owners: WORKFLOW_OWNERS,
        pageNum: result.pageNum,
        pageSize: result.pageSize,
        summary: summarizeWorkflowDefinitions(WORKFLOW_STORE.items),
        total: result.total,
      },
      '获取流程列表成功',
    );
  },
  method: 'GET',
  path: '/enterprise/workflow/list',
});
