import { generateAlerts } from '../../../utils/db/security';
import { paginateList } from '../../../utils/pagination';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler: ({ query }) => {
    // 仪表盘面板不带分页参数 → 仍拿全量 8 条；表格带 pageNum/pageSize 则按页返回
    return success(paginateList(generateAlerts(8), query), 'ok');
  },
  method: 'GET',
  path: '/security/alerts/list',
});
