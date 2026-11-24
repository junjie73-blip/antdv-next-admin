/** 告警列表：从持久化告警表做真实分页查询（处置后数量会真实减少） */
import { SECURITY_ALERTS } from '../../../utils/db/security';
import { paginateList } from '../../../utils/pagination';
import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

export default defineMockRoute({
  handler: ({ query }) =>
    success(paginateList([...SECURITY_ALERTS], query), 'ok'),
  method: 'GET',
  path: '/security/alerts/list',
});
